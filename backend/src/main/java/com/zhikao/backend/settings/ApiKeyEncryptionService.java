package com.zhikao.backend.settings;

import com.zhikao.backend.config.AppProperties;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

@Service
public class ApiKeyEncryptionService {
  private static final int IV_BYTES = 12;
  private static final int TAG_BITS = 128;

  private final SecretKeySpec key;
  private final SecureRandom secureRandom = new SecureRandom();

  public ApiKeyEncryptionService(AppProperties properties) {
    this.key = new SecretKeySpec(sha256(properties.modelSettingsEncryptionKey()), "AES");
  }

  public String encrypt(String plaintext) {
    if (plaintext == null || plaintext.isBlank()) {
      return null;
    }
    try {
      byte[] iv = new byte[IV_BYTES];
      secureRandom.nextBytes(iv);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
      byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
      ByteBuffer buffer = ByteBuffer.allocate(iv.length + ciphertext.length);
      buffer.put(iv);
      buffer.put(ciphertext);
      return "v1:" + Base64.getEncoder().encodeToString(buffer.array());
    } catch (GeneralSecurityException error) {
      throw new IllegalStateException("API key encryption failed", error);
    }
  }

  public String decrypt(String encrypted) {
    if (encrypted == null || encrypted.isBlank()) {
      return null;
    }
    if (!encrypted.startsWith("v1:")) {
      throw new IllegalArgumentException("Unsupported API key ciphertext");
    }
    try {
      byte[] combined = Base64.getDecoder().decode(encrypted.substring(3));
      if (combined.length <= IV_BYTES) {
        throw new IllegalArgumentException("Invalid API key ciphertext");
      }
      byte[] iv = new byte[IV_BYTES];
      byte[] ciphertext = new byte[combined.length - IV_BYTES];
      System.arraycopy(combined, 0, iv, 0, IV_BYTES);
      System.arraycopy(combined, IV_BYTES, ciphertext, 0, ciphertext.length);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
      return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    } catch (RuntimeException | GeneralSecurityException error) {
      throw new IllegalArgumentException("Stored API key cannot be decrypted", error);
    }
  }

  public String mask(String apiKey) {
    if (apiKey == null || apiKey.isBlank()) {
      return null;
    }
    String trimmed = apiKey.trim();
    return "****" + trimmed.substring(Math.max(0, trimmed.length() - 4));
  }

  private static byte[] sha256(String value) {
    try {
      return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
    } catch (GeneralSecurityException error) {
      throw new IllegalStateException("SHA-256 unavailable", error);
    }
  }
}
