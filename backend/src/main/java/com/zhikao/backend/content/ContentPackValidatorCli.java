package com.zhikao.backend.content;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;

public class ContentPackValidatorCli {
  public static void main(String[] args) {
    Path packDir = Path.of(args.length == 0 ? "../content-samples" : args[0]);
    ObjectMapper mapper = new ObjectMapper();
    ContentPackValidator validator = new ContentPackValidator(mapper);
    ContentPackValidationReport report = validator.validate(packDir);
    if (report.isValid()) {
      System.out.printf("Content pack valid: %s (%d items)%n", report.getPackId(), report.getItemCount());
      return;
    }
    System.err.printf("Content pack invalid: %s%n", packDir);
    for (String error : report.getErrors()) {
      System.err.println("- " + error);
    }
    System.exit(1);
  }
}
