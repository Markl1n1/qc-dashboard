
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { EvaluationCategory } from '../types/lemurEvaluation';
import { evaluationCategoriesService } from '../services/evaluationCategoriesService';
import { useToast } from './ui/use-toast';

interface CategoryManagerProps {
  categories: EvaluationCategory[];
  onCategoriesChange: (categories: EvaluationCategory[]) => void;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  categories,
  onCategoriesChange
}) => {
  const { toast } = useToast();
  const [editingCategory, setEditingCategory] = useState<EvaluationCategory | null>(null);

  const addCategory = (category: EvaluationCategory) => {
    evaluationCategoriesService.addCategory(category);
    const updated = evaluationCategoriesService.getCategories();
    onCategoriesChange(updated);
    
    toast({
      title: "Category Added",
      description: `"${category.name}" has been added successfully.`
    });
  };

  const updateCategory = (categoryId: string, updates: Partial<EvaluationCategory>) => {
    evaluationCategoriesService.updateCategory(categoryId, updates);
    const updated = evaluationCategoriesService.getCategories();
    onCategoriesChange(updated);
    
    toast({
      title: "Category Updated",
      description: "Category has been updated successfully."
    });
  };

  const removeCategory = (categoryId: string) => {
    evaluationCategoriesService.removeCategory(categoryId);
    const updated = evaluationCategoriesService.getCategories();
    onCategoriesChange(updated);
    
    toast({
      title: "Category Removed",
      description: "Category has been removed successfully."
    });
  };

  const toggleCategoryEnabled = (categoryId: string, enabled: boolean) => {
    updateCategory(categoryId, { enabled });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Evaluation Categories ({categories.length})</CardTitle>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Evaluation Category</DialogTitle>
              </DialogHeader>
              <CategoryEditor onSave={addCategory} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {categories.map(category => (
          <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3 flex-1">
              <div 
                className="w-4 h-4 rounded-full flex-shrink-0" 
                style={{ backgroundColor: category.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium truncate">{category.name}</span>
                  {!category.enabled && (
                    <Badge variant="outline" className="text-xs">Disabled</Badge>
                  )}
                  {category.weight && category.weight !== 1 && (
                    <Badge variant="outline" className="text-xs">
                      Weight: {category.weight}
                    </Badge>
                  )}
                </div>
                {category.description && (
                  <p className="text-sm text-muted-foreground truncate">
                    {category.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleCategoryEnabled(category.id, !category.enabled)}
              >
                {category.enabled ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Category</DialogTitle>
                  </DialogHeader>
                  <CategoryEditor 
                    category={category} 
                    onSave={(updatedCategory) => updateCategory(category.id, updatedCategory)} 
                  />
                </DialogContent>
              </Dialog>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => removeCategory(category.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        
        {categories.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No categories configured. Add your first category to get started.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Category Editor Component
const CategoryEditor: React.FC<{
  category?: EvaluationCategory;
  onSave: (category: EvaluationCategory) => void;
}> = ({ category, onSave }) => {
  const [formData, setFormData] = useState<Partial<EvaluationCategory>>(
    category || evaluationCategoriesService.createCategoryTemplate()
  );
  const [errors, setErrors] = useState<string[]>([]);

  const predefinedColors = [
    'hsl(var(--primary))',
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(var(--success))',
    'hsl(var(--warning))',
    'hsl(var(--destructive))',
    'hsl(var(--muted-foreground))'
  ];

  const handleSave = () => {
    const validationErrors = evaluationCategoriesService.validateCategory(formData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    onSave(formData as EvaluationCategory);
    setErrors([]);
  };

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <Alert>
          <AlertDescription>
            <ul className="list-disc list-inside">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Customer Rapport"
          />
        </div>
        
        <div>
          <Label htmlFor="category-id">ID</Label>
          <Input
            id="category-id"
            value={formData.id || ''}
            onChange={(e) => setFormData({ ...formData, id: e.target.value })}
            placeholder="e.g., customer_rapport"
            disabled={!!category} // Don't allow ID changes for existing categories
          />
        </div>
      </div>

      <div>
        <Label htmlFor="category-description">Description (Optional)</Label>
        <Textarea
          id="category-description"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of what this category evaluates..."
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Color</Label>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {predefinedColors.map((color, index) => (
              <button
                key={index}
                type="button"
                className={`w-8 h-8 rounded-full border-2 ${
                  formData.color === color ? 'border-foreground' : 'border-border'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setFormData({ ...formData, color })}
              />
            ))}
          </div>
        </div>
        
        <div>
          <Label htmlFor="category-weight">Weight (Optional)</Label>
          <Input
            id="category-weight"
            type="number"
            min="0.1"
            max="5"
            step="0.1"
            value={formData.weight || 1}
            onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 1 })}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="category-enabled"
          checked={formData.enabled !== false}
          onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
        />
        <Label htmlFor="category-enabled">Enabled</Label>
      </div>

      <Button onClick={handleSave} className="w-full">
        Save Category
      </Button>
    </div>
  );
};
