export interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'uuid' | 'address' | 'decimal';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  customValidator?: (value: any) => boolean;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

class InputValidator {
  private static readonly MAX_STRING_LENGTH = 10000;
  private static readonly MAX_ARRAY_LENGTH = 1000;
  private static readonly MAX_OBJECT_DEPTH = 10;

  static validateValue(value: any, rule: ValidationRule, fieldName: string): string | null {
    // Check required
    if (rule.required && (value === null || value === undefined || value === '')) {
      return `${fieldName} is required`;
    }

    if (!rule.required && (value === null || value === undefined || value === '')) {
      return null; // Optional field, no value
    }

    // Type validation
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          return `${fieldName} must be a string`;
        }
        if (value.length > (rule.max || this.MAX_STRING_LENGTH)) {
          return `${fieldName} exceeds maximum length of ${rule.max || this.MAX_STRING_LENGTH}`;
        }
        if (rule.min && value.length < rule.min) {
          return `${fieldName} must be at least ${rule.min} characters`;
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          return `${fieldName} has invalid format`;
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return `${fieldName} must be a number`;
        }
        if (rule.min !== undefined && value < rule.min) {
          return `${fieldName} must be at least ${rule.min}`;
        }
        if (rule.max !== undefined && value > rule.max) {
          return `${fieldName} must be at most ${rule.max}`;
        }
        break;

      case 'decimal':
        if (typeof value !== 'string' && typeof value !== 'number') {
          return `${fieldName} must be a decimal`;
        }
        const decimalStr = String(value);
        if (!/^\d+(\.\d{1,8})?$/.test(decimalStr)) {
          return `${fieldName} must be a valid decimal with up to 8 decimal places`;
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return `${fieldName} must be a boolean`;
        }
        break;

      case 'email':
        if (typeof value !== 'string') {
          return `${fieldName} must be an email address`;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value) || value.length > 254) {
          return `${fieldName} must be a valid email`;
        }
        break;

      case 'uuid':
        if (typeof value !== 'string') {
          return `${fieldName} must be a UUID`;
        }
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(value)) {
          return `${fieldName} must be a valid UUID`;
        }
        break;

      case 'address':
        if (typeof value !== 'string') {
          return `${fieldName} must be an address`;
        }
        // Ethereum address or Bitcoin address
        const ethRegex = /^0x[a-fA-F0-9]{40}$/;
        const btcRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/;
        if (!ethRegex.test(value) && !btcRegex.test(value)) {
          return `${fieldName} must be a valid blockchain address`;
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return `${fieldName} must be an array`;
        }
        if (value.length > (rule.max || this.MAX_ARRAY_LENGTH)) {
          return `${fieldName} exceeds maximum array length of ${rule.max || this.MAX_ARRAY_LENGTH}`;
        }
        break;

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return `${fieldName} must be an object`;
        }
        break;
    }

    // Enum check
    if (rule.enum && !rule.enum.includes(value)) {
      return `${fieldName} must be one of: ${rule.enum.join(', ')}`;
    }

    // Custom validator
    if (rule.customValidator && !rule.customValidator(value)) {
      return `${fieldName} failed custom validation`;
    }

    return null;
  }

  static validate(data: any, schema: ValidationSchema): ValidationResult {
    const errors: Record<string, string> = {};

    for (const [fieldName, rule] of Object.entries(schema)) {
      const error = this.validateValue(data[fieldName], rule, fieldName);
      if (error) {
        errors[fieldName] = error;
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }
}

/**
 * Express middleware for validating request body against a schema
 * Returns 400 with validation errors if schema is violated
 */
export function validateRequest(schema: ValidationSchema) {
  return (req: any, res: any, next: any) => {
    const result = InputValidator.validate(req.body || {}, schema);
    
    if (!result.valid) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        correlationId: req.correlationId || 'unknown',
        details: result.errors
      });
    }
    
    next();
  };
}

export default InputValidator;
