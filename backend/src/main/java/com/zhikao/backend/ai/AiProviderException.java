package com.zhikao.backend.ai;

public class AiProviderException extends RuntimeException {
  private final AiClassification classification;

  public AiProviderException(AiClassification classification, String message) {
    super(message);
    this.classification = classification;
  }

  public AiClassification classification() {
    return classification;
  }
}
