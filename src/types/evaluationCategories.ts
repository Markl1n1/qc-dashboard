
export interface EvaluationCategory {
  id: string;
  name: string;
  description?: string;
  type: 'negative' | 'positive';
  weight: number; // 1-10
  enabled: boolean;
  rules: EvaluationRule[];
}

export interface EvaluationRule {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  enabled: boolean;
  weight: number; // 1-10
}

export interface EvaluationConfiguration {
  id: string;
  name: string;
  description: string;
  categories: EvaluationCategory[];
  createdAt: string;
  updatedAt: string;
}

// Function to get default categories with populated rules
export const getDefaultCategoriesWithRules = (): EvaluationCategory[] => {
  // Critical rules (negative)
  const criticalRules: EvaluationRule[] = [
    { id: 'cr1', name: 'Profane language', description: 'Use of profane or inappropriate language', categoryId: 'critical', enabled: true, weight: 10 },
    { id: 'cr2', name: 'Insults toward the client', description: 'Any form of insult or disrespectful language toward the client', categoryId: 'critical', enabled: true, weight: 10 },
    { id: 'cr3', name: 'Addressing the client informally', description: 'Using informal address without proper introduction', categoryId: 'critical', enabled: true, weight: 10 },
    { id: 'cr4', name: 'Using Ukrainian words', description: 'Using Ukrainian words in conversation', categoryId: 'critical', enabled: true, weight: 10 },
    { id: 'cr5', name: 'Promising money withdrawal at any time', description: 'Making promises about unrestricted money withdrawal', categoryId: 'critical', enabled: true, weight: 10 },
    { id: 'cr6', name: 'Guaranteeing profit', description: 'Making guarantees about profit or returns', categoryId: 'critical', enabled: true, weight: 10 },
    { id: 'cr7', name: 'Directly stating there are no risks', description: 'Claiming that there are no risks involved', categoryId: 'critical', enabled: true, weight: 10 },
    { id: 'cr8', name: 'Positioning the analyst as an assistant or consultant', description: 'Incorrectly positioning the analyst role', categoryId: 'critical', enabled: true, weight: 10 },
    { id: 'cr9', name: 'Intimidating the client', description: 'Using intimidation tactics with the client', categoryId: 'critical', enabled: true, weight: 10 },
    { id: 'cr10', name: 'Letting the client go for a follow-up call without addressing objections', description: 'Allowing follow-up without proper objection handling', categoryId: 'critical', enabled: true, weight: 10 },
    { id: 'cr11', name: 'Leading the client to deposit without asking about a crypto wallet', description: 'Not inquiring about crypto wallet before deposit process', categoryId: 'critical', enabled: true, weight: 10 },
    { id: 'cr12', name: 'Ending the conversation without handling objections', description: 'Concluding without addressing client objections', categoryId: 'critical', enabled: true, weight: 10 },
    { id: 'cr13', name: 'Interrupting the conversation without a logical conclusion', description: 'Abruptly ending conversation without proper closure', categoryId: 'critical', enabled: true, weight: 10 },
    { id: 'cr14', name: 'Ending the conversation by the agent without an agreement', description: 'Agent ending conversation without reaching an agreement', categoryId: 'critical', enabled: true, weight: 10 }
  ];

  // Mistake rules (negative)
  const mistakeRules: EvaluationRule[] = [
    { id: 'mr1', name: 'Using diminutive or affectionate words', description: 'Using inappropriate diminutive or overly affectionate language', categoryId: 'mistake', enabled: true, weight: 7 },
    { id: 'mr2', name: 'Familiarity in communication', description: 'Using overly familiar terms like "buddy," "bro," "sweetie"', categoryId: 'mistake', enabled: true, weight: 7 },
    { id: 'mr3', name: 'Using jargon or slang', description: 'Using inappropriate jargon or slang like "cash," "easy money," "jump in"', categoryId: 'mistake', enabled: true, weight: 7 },
    { id: 'mr4', name: 'Not adhering to the dialogue structure', description: 'Failing to follow the prescribed dialogue structure', categoryId: 'mistake', enabled: true, weight: 7 },
    { id: 'mr5', name: 'Collecting information in a questionnaire format', description: 'Using rigid question-answer-question-answer format', categoryId: 'mistake', enabled: true, weight: 7 },
    { id: 'mr6', name: 'Overly long and complex presentation', description: 'Making presentations that are too long or complex', categoryId: 'mistake', enabled: true, weight: 7 },
    { id: 'mr7', name: 'Positioning oneself as a consultant', description: 'Incorrectly positioning as a consultant rather than analyst', categoryId: 'mistake', enabled: true, weight: 7 },
    { id: 'mr8', name: 'Asking about salary before 3 minutes', description: 'Inquiring about client salary too early in the conversation', categoryId: 'mistake', enabled: true, weight: 7 },
    { id: 'mr9', name: 'Directly asking about saved money', description: 'Directly asking "how much money have you saved" or similar', categoryId: 'mistake', enabled: true, weight: 7 },
    { id: 'mr10', name: 'Moving to presentation without information gathering', description: 'Starting presentation without proper information collection', categoryId: 'mistake', enabled: true, weight: 7 },
    { id: 'mr11', name: 'Addressing false objections before presentation', description: 'Handling objections before completing the presentation', categoryId: 'mistake', enabled: true, weight: 7 },
    { id: 'mr12', name: 'Arguing with client at dialogue start', description: 'Starting arguments without transitioning to rapport-building', categoryId: 'mistake', enabled: true, weight: 7 },
    { id: 'mr13', name: 'Starting presentation with deposit call', description: 'Beginning presentation with a call to deposit funds', categoryId: 'mistake', enabled: true, weight: 7 },
    { id: 'mr14', name: 'Moving to presentation at first client request', description: 'Starting presentation immediately upon first client request', categoryId: 'mistake', enabled: true, weight: 7 },
    { id: 'mr15', name: 'Agreeing to follow-up call at first request', description: 'Immediately agreeing to follow-up call without exploration', categoryId: 'mistake', enabled: true, weight: 7 },
    { id: 'mr16', name: 'Selling news instead of handling objections', description: 'Using news selling instead of proper "no money" objection handling', categoryId: 'mistake', enabled: true, weight: 7 }
  ];

  // Not recommended rules (negative)
  const notRecommendedRules: EvaluationRule[] = [
    { id: 'nr1', name: 'Parasitic words (filler words)', description: 'Using excessive filler words or parasitic words', categoryId: 'not_recommended', enabled: true, weight: 3 },
    { id: 'nr2', name: 'Agent stumbles or hesitates in speech', description: 'Showing uncertainty or stumbling in speech delivery', categoryId: 'not_recommended', enabled: true, weight: 3 },
    { id: 'nr3', name: 'Excessive talkativeness or going off-topic', description: 'Talking too much or straying from the topic', categoryId: 'not_recommended', enabled: true, weight: 3 },
    { id: 'nr4', name: 'Repeating the same phrases (looping)', description: 'Repeating the same phrases or getting stuck in loops', categoryId: 'not_recommended', enabled: true, weight: 3 },
    { id: 'nr5', name: 'Overuse of affirmations', description: 'Excessive use of "uh-huh," "yep," "exactly," "right-right"', categoryId: 'not_recommended', enabled: true, weight: 3 },
    { id: 'nr6', name: 'Interrupting the client during conversation', description: 'Interrupting client unless to redirect and regain attention', categoryId: 'not_recommended', enabled: true, weight: 3 },
    { id: 'nr7', name: 'Using complex terms inappropriately', description: 'Using complex terms when client doesn\'t understand them', categoryId: 'not_recommended', enabled: true, weight: 3 },
    { id: 'nr8', name: 'Stating minimum amount at first request', description: 'Immediately stating minimum amount upon first client request', categoryId: 'not_recommended', enabled: true, weight: 3 }
  ];

  // Allowed rules (positive)
  const allowedRules: EvaluationRule[] = [
    { id: 'ar1', name: 'Referring to analyst with professional titles', description: 'Using appropriate titles: mentor, specialist, professional, trader, analyst', categoryId: 'allowed', enabled: true, weight: 3 },
    { id: 'ar2', name: 'Not selling news when unnecessary', description: 'Avoiding news selling when urgency is not needed', categoryId: 'allowed', enabled: true, weight: 3 },
    { id: 'ar3', name: 'Conducting closing as separate dialogue', description: 'Treating closing as a distinct part of the conversation', categoryId: 'allowed', enabled: true, weight: 3 },
    { id: 'ar4', name: 'Incomplete information collection', description: 'Not collecting all ideal information points', categoryId: 'allowed', enabled: true, weight: 3 },
    { id: 'ar5', name: 'Extended objection handling and closing', description: 'Taking more time than ideal for objection handling and closing', categoryId: 'allowed', enabled: true, weight: 3 },
    { id: 'ar6', name: 'Spending 2-3 minutes on initial objections', description: 'Taking appropriate time to handle initial objections', categoryId: 'allowed', enabled: true, weight: 3 },
    { id: 'ar7', name: 'Moving to presentation with minimal information', description: 'Starting presentation when client refuses to provide details beyond mandatory info', categoryId: 'allowed', enabled: true, weight: 3 },
    { id: 'ar8', name: 'Using closed-ended questions for clarification', description: 'Using many closed-ended questions to clarify information', categoryId: 'allowed', enabled: true, weight: 3 },
    { id: 'ar9', name: 'Stating profit using statistics', description: 'Referencing statistics or analytical center data for profit potential', categoryId: 'allowed', enabled: true, weight: 3 },
    { id: 'ar10', name: 'Referencing events for profit potential', description: 'Using upcoming or past events to explain profit potential', categoryId: 'allowed', enabled: true, weight: 3 }
  ];

  // Correct rules (positive) - comprehensive list
  const correctRules: EvaluationRule[] = [
    { id: 'cor1', name: 'Conduct dialogue according to structure', description: 'Following the prescribed dialogue structure throughout', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor2', name: 'Proper dialogue structure implementation', description: 'Greeting, Information Gathering, Presentation, Objection Handling, News Selling, Closing', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor3', name: 'Complete greeting protocol', description: 'Agent answers who is calling, where from, why calling with proper positioning', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor4', name: 'Financial market experience inquiry', description: 'Proper questions about trading, investing, binary options, venture funds experience', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor5', name: 'Relocation information gathering', description: 'Understanding reasons for relocation and basis for residing in new country', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor6', name: 'Profession information collection', description: 'Understanding profession, reasons, duration, achievements, goals, satisfaction, schedule, salary', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor7', name: 'Family information gathering', description: 'Understanding family priority, composition, spouse, children details', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor8', name: 'Financial difficulties assessment', description: 'Understanding size, reasons, and resolution views on financial difficulties', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor9', name: 'Financial goals exploration', description: 'Understanding what, why, and how client planned to achieve financial goals', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor10', name: 'Life goals discussion', description: 'Exploring broader life goals beyond material purchases', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor11', name: 'Structured presentation delivery', description: 'Including where/how client will earn, process visualization, trading method choice, analyst expertise, benefits, call to action', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor12', name: 'Proper objection handling', description: 'Systematically addressing client objections', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor13', name: 'Strategic news selling', description: 'Using news selling to create appropriate urgency', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor14', name: 'Effective closing process', description: 'Guiding client through account funding (activation)', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor15', name: 'Ideal dialogue timing (~20 minutes)', description: 'Maintaining appropriate overall dialogue duration', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor16', name: 'Proper greeting and information timing (5-10 min)', description: 'Appropriate time allocation for greeting and information gathering', categoryId: 'correct', enabled: true, weight: 10 },
    { id: 'cor17', name: 'Appropriate presentation timing (3-5 min)', description: 'Proper time allocation for presentation delivery', categoryId: 'correct', enabled: true, weight: 10 }
  ];

  return [
    {
      id: 'critical',
      name: 'Critical',
      type: 'negative',
      weight: 10,
      enabled: true,
      rules: criticalRules
    },
    {
      id: 'mistake',
      name: 'Mistake',
      type: 'negative',
      weight: 7,
      enabled: true,
      rules: mistakeRules
    },
    {
      id: 'not_recommended',
      name: 'Not Recommended',
      type: 'negative',
      weight: 3,
      enabled: true,
      rules: notRecommendedRules
    },
    {
      id: 'allowed',
      name: 'Allowed',
      type: 'positive',
      weight: 3,
      enabled: true,
      rules: allowedRules
    },
    {
      id: 'correct',
      name: 'Correct',
      type: 'positive',
      weight: 10,
      enabled: true,
      rules: correctRules
    }
  ];
};

export const DEFAULT_CATEGORIES = getDefaultCategoriesWithRules();
