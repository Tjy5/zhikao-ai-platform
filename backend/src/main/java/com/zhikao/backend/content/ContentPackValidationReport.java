package com.zhikao.backend.content;

import java.util.ArrayList;
import java.util.List;

public class ContentPackValidationReport {
  private final String packDir;
  private String packId;
  private int itemCount;
  private boolean valid;
  private final List<String> errors = new ArrayList<>();
  private final List<String> warnings = new ArrayList<>();

  public ContentPackValidationReport(String packDir) {
    this.packDir = packDir;
  }

  public String getPackDir() {
    return packDir;
  }

  public String getPackId() {
    return packId;
  }

  public void setPackId(String packId) {
    this.packId = packId;
  }

  public int getItemCount() {
    return itemCount;
  }

  public void setItemCount(int itemCount) {
    this.itemCount = itemCount;
  }

  public boolean isValid() {
    return valid;
  }

  public void setValid(boolean valid) {
    this.valid = valid;
  }

  public List<String> getErrors() {
    return errors;
  }

  public List<String> getWarnings() {
    return warnings;
  }
}
