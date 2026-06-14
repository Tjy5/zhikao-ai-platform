import { useState, useCallback } from 'react';

// Per-field validation rule: the validator receives the value type of the
// specific field it is attached to (T[K]), not a union of all field types.
export type ValidationRule<T> = {
  [K in keyof T]: {
    field: K;
    validate: (value: T[K], formData: T) => string | null;
    trigger?: 'blur' | 'change' | 'submit';
  };
}[keyof T];

export interface UseFormValidationReturn<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  handleChange: <K extends keyof T>(field: K, value: T[K]) => void;
  handleBlur: (field: keyof T) => void;
  validate: () => boolean;
  setServerErrors: (errors: Record<string, string>) => void;
  reset: () => void;
}

export function useFormValidation<T extends object>(
  initialValues: T,
  rules: ValidationRule<T>[]
): UseFormValidationReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const validateField = useCallback(
    <K extends keyof T>(field: K, value: T[K]): string | null => {
      const rule = rules.find((r) => r.field === field);
      if (!rule) return null;
      return rule.validate(value, values);
    },
    [rules, values]
  );

  const handleChange = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setValues((prev) => ({ ...prev, [field]: value }));

      // Validate on change if rule specifies it
      const rule = rules.find((r) => r.field === field);
      if (rule?.trigger === 'change') {
        const error = validateField(field, value);
        setErrors((prev) => ({ ...prev, [field]: error || undefined }));
      }
    },
    [rules, validateField]
  );

  const handleBlur = useCallback(
    (field: keyof T) => {
      setTouched((prev) => ({ ...prev, [field]: true }));

      // Validate on blur if rule specifies it
      const rule = rules.find((r) => r.field === field);
      if (rule?.trigger === 'blur' || rule?.trigger === undefined) {
        const error = validateField(field, values[field]);
        setErrors((prev) => ({ ...prev, [field]: error || undefined }));
      }
    },
    [rules, validateField, values]
  );

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    rules.forEach((rule) => {
      const error = rule.validate(values[rule.field], values);
      if (error) {
        newErrors[rule.field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [rules, values]);

  const setServerErrors = useCallback((serverErrors: Record<string, string>) => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    Object.entries(serverErrors).forEach(([key, message]) => {
      newErrors[key as keyof T] = message;
    });
    setErrors(newErrors);
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validate,
    setServerErrors,
    reset,
  };
}

export default useFormValidation;
