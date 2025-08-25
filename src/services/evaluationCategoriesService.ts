
import { EvaluationCategory, DEFAULT_RULE_CATEGORIES } from '../types/lemurEvaluation';

class EvaluationCategoriesService {
  private storageKey = 'lemur_evaluation_categories';

  getCategories(): EvaluationCategory[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load evaluation categories from storage:', error);
    }
    
    // Return default categories if nothing stored
    return DEFAULT_RULE_CATEGORIES;
  }

  addCategory(category: EvaluationCategory): void {
    const stored = this.getCategories();
    const updated = [...stored.filter(c => c.id !== category.id), category];
    this.saveCategories(updated);
  }

  updateCategory(categoryId: string, updates: Partial<EvaluationCategory>): void {
    const stored = this.getCategories();
    const updated = stored.map(category => 
      category.id === categoryId ? { ...category, ...updates } : category
    );
    this.saveCategories(updated);
  }

  removeCategory(categoryId: string): void {
    const stored = this.getCategories();
    const updated = stored.filter(category => category.id !== categoryId);
    this.saveCategories(updated);
  }

  getCategory(categoryId: string): EvaluationCategory | null {
    const stored = this.getCategories();
    return stored.find(category => category.id === categoryId) || null;
  }

  getEnabledCategories(): EvaluationCategory[] {
    return this.getCategories().filter(category => category.enabled);
  }

  validateCategory(category: Partial<EvaluationCategory>): string[] {
    const errors: string[] = [];

    if (!category.name || category.name.trim().length < 2) {
      errors.push('Category name must be at least 2 characters long');
    }

    if (!category.id || category.id.trim().length < 2) {
      errors.push('Category ID must be at least 2 characters long');
    }

    if (!category.color || !category.color.startsWith('hsl(')) {
      errors.push('Category color must be a valid HSL color');
    }

    // Check for duplicate names and IDs
    const existing = this.getCategories();
    if (existing.some(c => c.name === category.name && c.id !== category.id)) {
      errors.push('Category name must be unique');
    }

    if (existing.some(c => c.id === category.id)) {
      // This is an update, not a duplicate check for new categories
    }

    return errors;
  }

  private saveCategories(categories: EvaluationCategory[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(categories));
    } catch (error) {
      console.error('Failed to save evaluation categories to storage:', error);
    }
  }

  initializeDefaults(): void {
    const stored = this.getCategories();
    if (stored.length === 0) {
      this.saveCategories(DEFAULT_RULE_CATEGORIES);
    }
  }

  createCategoryTemplate(): Partial<EvaluationCategory> {
    return {
      id: `category_${Date.now()}`,
      name: '',
      description: '',
      color: 'hsl(var(--chart-5))',
      weight: 1,
      enabled: true
    };
  }

  getStatistics(): {
    total: number;
    enabled: number;
    disabled: number;
  } {
    const categories = this.getCategories();
    return {
      total: categories.length,
      enabled: categories.filter(c => c.enabled).length,
      disabled: categories.filter(c => !c.enabled).length
    };
  }

  // Export/Import functionality
  exportCategories(): string {
    return JSON.stringify(this.getCategories(), null, 2);
  }

  importCategories(jsonData: string): void {
    try {
      const categories: EvaluationCategory[] = JSON.parse(jsonData);
      
      // Validate all categories before importing
      const errors: string[] = [];
      categories.forEach((category, index) => {
        const categoryErrors = this.validateCategory(category);
        if (categoryErrors.length > 0) {
          errors.push(`Category ${index + 1}: ${categoryErrors.join(', ')}`);
        }
      });

      if (errors.length > 0) {
        throw new Error(`Validation errors: ${errors.join('; ')}`);
      }

      this.saveCategories(categories);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Invalid JSON format for categories import');
    }
  }
}

export const evaluationCategoriesService = new EvaluationCategoriesService();
