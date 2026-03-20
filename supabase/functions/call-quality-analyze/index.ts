import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Utterance {
  speaker: string;
  text: string;
  confidence: number;
  start_time: number;
  end_time: number;
}

interface QualityIssue {
  type: string;
  timestamp: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface CategoryScore {
  score: number;
  issues: string[];
}

function analyzeMetrics(utterances: Utterance[]) {
  const issues: QualityIssue[] = [];
  
  // 1. Audio clarity — based on confidence scores
  const confidences = utterances.map(u => u.confidence).filter(c => c > 0);
  const avgConfidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
  const lowConfidenceUtterances = utterances.filter(u => u.confidence > 0 && u.confidence < 0.7);
  const lowConfidencePct = utterances.length > 0 ? (lowConfidenceUtterances.length / utterances.length) * 100 : 0;
  
  // Track low confidence clusters
  let lowConfCluster = 0;
  for (const u of utterances) {
    if (u.confidence > 0 && u.confidence < 0.65) {
      lowConfCluster++;
      if (lowConfCluster >= 3) {
        issues.push({
          type: 'low_clarity',
          timestamp: u.start_time,
          description: `Cluster of ${lowConfCluster} low-confidence utterances (avg conf < 0.65)`,
          severity: 'high'
        });
        lowConfCluster = 0;
      }
    } else {
      lowConfCluster = 0;
    }
  }

  // 2. Connection stability — gaps between utterances
  const gaps: { duration: number; timestamp: number }[] = [];
  for (let i = 1; i < utterances.length; i++) {
    const gap = utterances[i].start_time - utterances[i - 1].end_time;
    if (gap > 3) {
      gaps.push({ duration: gap, timestamp: utterances[i - 1].end_time });
      issues.push({
        type: 'connection_gap',
        timestamp: utterances[i - 1].end_time,
        description: `${gap.toFixed(1)}s silence gap between utterances`,
        severity: gap > 8 ? 'high' : gap > 5 ? 'medium' : 'low'
      });
    }
  }

  // 3. Interruptions — speaker overlaps
  const overlaps: { timestamp: number; duration: number }[] = [];
  for (let i = 1; i < utterances.length; i++) {
    if (utterances[i].speaker !== utterances[i - 1].speaker) {
      const overlap = utterances[i - 1].end_time - utterances[i].start_time;
      if (overlap > 0.3) {
        overlaps.push({ timestamp: utterances[i].start_time, duration: overlap });
        issues.push({
          type: 'interruption',
          timestamp: utterances[i].start_time,
          description: `Speaker overlap: ${overlap.toFixed(1)}s interruption`,
          severity: overlap > 2 ? 'high' : overlap > 1 ? 'medium' : 'low'
        });
      }
    }
  }

  // 4. Very short utterances in sequence (potential audio breakup)
  let shortSeq = 0;
  for (const u of utterances) {
    if (u.text.length < 5 && (u.end_time - u.start_time) < 0.5) {
      shortSeq++;
      if (shortSeq >= 3) {
        issues.push({
          type: 'audio_breakup',
          timestamp: u.start_time,
          description: `${shortSeq} very short fragments in sequence — possible audio breakup`,
          severity: 'medium'
        });
        shortSeq = 0;
      }
    } else {
      shortSeq = 0;
    }
  }

  // Calculate category scores
  const clarityScore = Math.max(0, Math.min(100, Math.round(
    avgConfidence > 0 ? (avgConfidence * 80) + (lowConfidencePct < 5 ? 20 : lowConfidencePct < 15 ? 10 : 0) : 50
  )));

  const gapsOver5 = gaps.filter(g => g.duration > 5).length;
  const connectionScore = Math.max(0, Math.min(100, 100 - (gapsOver5 * 15) - (gaps.length * 5)));

  const interruptionScore = Math.max(0, Math.min(100, 100 - (overlaps.length * 8)));

  return {
    clarityScore,
    connectionScore,
    interruptionScore,
    issues,
    lowConfidencePct: Math.round(lowConfidencePct),
    gapCount: gaps.length,
    gapsOver5,
    overlapCount: overlaps.length,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dialogId, utterances } = await req.json();

    if (!dialogId || !utterances || !Array.isArray(utterances)) {
      return new Response(JSON.stringify({ error: 'Missing dialogId or utterances' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Analyzing call quality for dialog ${dialogId}, ${utterances.length} utterances`);

    // Step 1: Compute metrics
    const metrics = analyzeMetrics(utterances);

    // Step 2: LLM semantic analysis
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let communicationScore = 80;
    const communicationIssues: string[] = [];
    const llmIssues: QualityIssue[] = [];

    if (LOVABLE_API_KEY && utterances.length > 0) {
      try {
        // Build a compact transcript for LLM
        const transcript = utterances
          .slice(0, 200) // limit to first 200 for cost
          .map((u: Utterance) => `[${u.speaker}] ${u.text}`)
          .join('\n');

        const prompt = `Analyze this call center transcript for COMMUNICATION QUALITY issues only. Look for:
1. Phrases indicating someone can't hear ("can you hear me?", "алло?", "повторите", "не слышу", "halo?", "słyszysz mnie?")
2. Repeated phrases suggesting poor audio (same thing said 2+ times in a row)
3. Incomplete/cut-off sentences suggesting connection drops
4. Signs of voice trembling or distress in agent's speech patterns

Return JSON with this exact structure:
{
  "communicationScore": <0-100>,
  "issues": [
    {"timestamp_approx": <seconds>, "description": "<brief description>", "severity": "low|medium|high"}
  ],
  "summary": "<1 sentence summary>"
}

Transcript:
${transcript}`;

        const llmResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [
              { role: 'system', content: 'You are a call quality analyst. Return only valid JSON, no markdown.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.1,
          }),
        });

        if (llmResponse.ok) {
          const llmData = await llmResponse.json();
          const content = llmData.choices?.[0]?.message?.content || '';
          
          // Parse JSON from response (handle markdown code blocks)
          let jsonStr = content;
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) jsonStr = jsonMatch[1];
          
          try {
            const parsed = JSON.parse(jsonStr.trim());
            communicationScore = parsed.communicationScore ?? 80;
            
            if (parsed.issues && Array.isArray(parsed.issues)) {
              for (const issue of parsed.issues) {
                communicationIssues.push(issue.description);
                llmIssues.push({
                  type: 'communication',
                  timestamp: issue.timestamp_approx || 0,
                  description: issue.description,
                  severity: issue.severity || 'medium'
                });
              }
            }
          } catch (parseErr) {
            console.warn('⚠️ Failed to parse LLM response:', parseErr);
          }
        } else {
          const errStatus = llmResponse.status;
          console.warn(`⚠️ LLM returned ${errStatus}, using metrics-only analysis`);
        }
      } catch (llmErr) {
        console.warn('⚠️ LLM analysis failed, using metrics only:', llmErr);
      }
    }

    // Step 3: Combine results
    const allIssues = [...metrics.issues, ...llmIssues];
    
    const categories = {
      audioClarity: {
        score: metrics.clarityScore,
        issues: [
          ...(metrics.lowConfidencePct > 5 ? [`Low confidence in ${metrics.lowConfidencePct}% of utterances`] : []),
          ...(metrics.avgConfidence < 0.75 ? [`Average confidence: ${metrics.avgConfidence}`] : []),
        ]
      } as CategoryScore,
      connectionStability: {
        score: metrics.connectionScore,
        issues: [
          ...(metrics.gapCount > 0 ? [`${metrics.gapCount} silence gaps >3s detected`] : []),
          ...(metrics.gapsOver5 > 0 ? [`${metrics.gapsOver5} critical gaps >5s`] : []),
        ]
      } as CategoryScore,
      interruptions: {
        score: metrics.interruptionScore,
        issues: [
          ...(metrics.overlapCount > 0 ? [`${metrics.overlapCount} speaker overlaps detected`] : []),
        ]
      } as CategoryScore,
      communication: {
        score: communicationScore,
        issues: communicationIssues
      } as CategoryScore,
    };

    // Overall = weighted average
    const overallScore = Math.round(
      categories.audioClarity.score * 0.3 +
      categories.connectionStability.score * 0.25 +
      categories.interruptions.score * 0.2 +
      categories.communication.score * 0.25
    );

    const result = { overallScore, categories, details: allIssues };

    // Step 4: Save to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const { error: upsertError } = await supabaseAdmin
      .from('call_quality_analysis')
      .upsert({
        dialog_id: dialogId,
        overall_score: overallScore,
        categories,
        details: allIssues,
      }, { onConflict: 'dialog_id' });

    if (upsertError) {
      console.error('❌ Failed to save call quality:', upsertError);
    } else {
      console.log(`✅ Call quality saved: score=${overallScore}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('❌ Call quality analysis error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
