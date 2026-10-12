export const FORM_VALIDATION_CONTEXT = Symbol('mosaic:form-validation');
export interface FormValidationRegistry {
  register(label: string, validate: () => boolean): () => void;
}
