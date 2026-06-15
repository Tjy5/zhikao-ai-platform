package com.zhikao.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.zhikao.backend.data.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Contract tests for the study content versioning / proposal / audit backend (child-3). Mirrors
 * the {@code registerAndLoginAdmin} helper from {@link RbacContractTests} (register -> promote via
 * {@code UserRepository.updateRole} -> the JWT filter reloads the DB role each request, so the same
 * bearer works). All endpoints require a logged-in session; admin writers require ROLE_ADMIN.
 */
class StudyContentContractTests extends IntegrationTestSupport {
  @Autowired private UserRepository userRepository;

  // ---------- seed ----------

  @Test
  void seederPublishesAllNineBaselineSections() throws Exception {
    Session user = registerAndLogin("study_seed");
    MvcResult result =
        mockMvc
            .perform(get("/api/v1/study/sections").header("Authorization", user.authHeader()))
            .andExpect(status().isOk())
            .andReturn();
    JsonNode sections = json(result).path("sections");
    assertThat(sections.isArray()).isTrue();
    assertThat(sections.size()).isEqualTo(9);
    // Every section must have live content and a baseline seed row in its history. Other tests in
    // this class mutate shared global sections (shared temp DB), so assertions are pollution-aware:
    // we only require the seeder ran (a seed row exists), not that the section is still pristine.
    for (JsonNode section : sections) {
      String key = section.path("section_key").asText();
      assertThat(section.path("content_json").isObject() || section.path("content_json").isArray())
          .as("section %s has structured content_json", key)
          .isTrue();
      MvcResult rev =
          mockMvc
              .perform(
                  get("/api/v1/study/sections/" + key + "/revisions")
                      .header("Authorization", user.authHeader()))
              .andExpect(status().isOk())
              .andReturn();
      JsonNode rows = json(rev).path("revisions");
      assertThat(rows.size()).isGreaterThanOrEqualTo(1);
      boolean hasSeed =
          java.util.stream.IntStream.range(0, rows.size())
              .anyMatch(i -> "seed".equals(rows.get(i).path("action").asText()));
      assertThat(hasSeed).as("section %s was seeded", key).isTrue();
    }
  }

  // ---------- direct edit ----------

  @Test
  void adminDirectEditPublishesNewVersionAndSupersedesTheOld() throws Exception {
    Session admin = registerAndLoginAdmin("study_edit");
    String original =
        mockMvc
            .perform(
                get("/api/v1/study/sections/exam-scan").header("Authorization", admin.authHeader()))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    MvcResult edit =
        mockMvc
            .perform(
                post("/api/v1/study/sections/exam-scan/edit")
                    .header("Authorization", admin.authHeader())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        body(
                            "[{\"title\":\"edited-title\",\"summary\":\"edited\",\"points\":[]}]",
                            "直改测试")))
            .andExpect(status().isOk())
            .andReturn();
    long newId = json(edit).path("id").asLong();
    assertThat(json(edit).path("action").asText()).isEqualTo("direct_edit");
    assertThat(json(edit).path("status").asText()).isEqualTo("published");
    assertThat(json(edit).path("author_username").asText()).isEqualTo(adminUsername(admin));

    // Live content now reflects the edit.
    MvcResult live =
        mockMvc
            .perform(
                get("/api/v1/study/sections/exam-scan").header("Authorization", admin.authHeader()))
            .andExpect(status().isOk())
            .andReturn();
    assertThat(json(live).path("content_json").get(0).path("title").asText())
        .isEqualTo("edited-title");
    assertThat(live.getResponse().getContentAsString()).isNotEqualTo(original);

    // History keeps the seed (superseded) AND the new direct_edit (published).
    MvcResult revisions =
        mockMvc
            .perform(
                get("/api/v1/study/sections/exam-scan/revisions")
                    .header("Authorization", admin.authHeader()))
            .andExpect(status().isOk())
            .andReturn();
    JsonNode rows = json(revisions).path("revisions");
    assertThat(rows.get(0).path("id").asLong()).isEqualTo(newId);
    assertThat(rows.get(0).path("action").asText()).isEqualTo("direct_edit");
    assertThat(rows.get(0).path("status").asText()).isEqualTo("published");
    assertThat(rows.get(1).path("action").asText()).isEqualTo("seed");
    assertThat(rows.get(1).path("status").asText()).isEqualTo("superseded");
  }

  // ---------- propose ----------

  @Test
  void userProposeLeavesLiveContentUnchangedAndShowsInAdminQueue() throws Exception {
    Session user = registerAndLogin("study_propose");
    Session admin = registerAndLoginAdmin("study_propose_admin");

    String before =
        mockMvc
            .perform(
                get("/api/v1/study/sections/review-rules").header("Authorization", user.authHeader()))
            .andReturn()
            .getResponse()
            .getContentAsString();

    MvcResult propose =
        mockMvc
            .perform(
                post("/api/v1/study/sections/review-rules/propose")
                    .header("Authorization", user.authHeader())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body("[{\"title\":\"proposed-rule\",\"cue\":\"c\",\"detail\":\"d\"}]", "用户提案")))
            .andExpect(status().isOk())
            .andReturn();
    long proposalId = json(propose).path("id").asLong();
    assertThat(json(propose).path("action").asText()).isEqualTo("propose");
    assertThat(json(propose).path("status").asText()).isEqualTo("proposed");
    assertThat(json(propose).path("author_username").asText())
        .isEqualTo(userUsername(user));

    // Live content unchanged.
    String after =
        mockMvc
            .perform(
                get("/api/v1/study/sections/review-rules").header("Authorization", user.authHeader()))
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(after).isEqualTo(before);

    // Visible only to admin in the queue.
    mockMvc
        .perform(
            post("/api/v1/study/sections/review-rules/propose")
                .header("Authorization", user.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("[{\"title\":\"second\"}]", null)))
        .andExpect(status().isOk());
    mockMvc
        .perform(get("/api/v1/study/proposals").header("Authorization", user.authHeader()))
        .andExpect(status().isForbidden());
    MvcResult queue =
        mockMvc
            .perform(get("/api/v1/study/proposals").header("Authorization", admin.authHeader()))
            .andExpect(status().isOk())
            .andReturn();
    assertThat(json(queue).path("total").asInt()).isGreaterThanOrEqualTo(1);
    JsonNode proposals = json(queue).path("proposals");
    boolean found =
        java.util.stream.IntStream.range(0, proposals.size())
            .anyMatch(i -> proposals.get(i).path("id").asLong() == proposalId);
    assertThat(found).isTrue();
  }

  // ---------- approve ----------

  @Test
  void adminApproveMakesProposalLiveKeepingProposerAsAuthor() throws Exception {
    Session proposer = registerAndLogin("study_approve_user");
    Session admin = registerAndLoginAdmin("study_approve_admin");

    long proposalId =
        json(
                mockMvc
                    .perform(
                        post("/api/v1/study/sections/pitfalls/propose")
                            .header("Authorization", proposer.authHeader())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body("[{\"issue\":\"approved-issue\",\"correction\":\"c\"}]", "待批")))
                    .andExpect(status().isOk())
                    .andReturn())
            .path("id")
            .asLong();

    MvcResult approve =
        mockMvc
            .perform(
                post("/api/v1/study/revisions/" + proposalId + "/approve")
                    .header("Authorization", admin.authHeader()))
            .andExpect(status().isOk())
            .andReturn();
    long publishedId = json(approve).path("id").asLong();
    assertThat(json(approve).path("action").asText()).isEqualTo("approve");
    assertThat(json(approve).path("status").asText()).isEqualTo("published");
    // author = proposer (server-derived from the proposal row), reviewer = admin.
    assertThat(json(approve).path("author_username").asText()).isEqualTo(userUsername(proposer));
    assertThat(json(approve).path("reviewer_username").asText()).isEqualTo(adminUsername(admin));
    assertThat(json(approve).path("parent_revision_id").asLong()).isEqualTo(proposalId);

    // Live content now reflects the approved proposal.
    MvcResult live =
        mockMvc
            .perform(
                get("/api/v1/study/sections/pitfalls").header("Authorization", admin.authHeader()))
            .andExpect(status().isOk())
            .andReturn();
    assertThat(json(live).path("content_json").get(0).path("issue").asText())
        .isEqualTo("approved-issue");

    // The proposal itself is now superseded.
    MvcResult proposalRow =
        mockMvc
            .perform(
                get("/api/v1/study/revisions/" + proposalId).header("Authorization", admin.authHeader()))
            .andExpect(status().isOk())
            .andReturn();
    assertThat(json(proposalRow).path("status").asText()).isEqualTo("superseded");
  }

  // ---------- reject ----------

  @Test
  void adminRejectMarksProposalRejectedWithoutChangingLive() throws Exception {
    Session proposer = registerAndLogin("study_reject_user");
    Session admin = registerAndLoginAdmin("study_reject_admin");

    long proposalId =
        json(
                mockMvc
                    .perform(
                        post("/api/v1/study/sections/pitfalls/propose")
                            .header("Authorization", proposer.authHeader())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body("[{\"issue\":\"to-reject\"}]", null)))
                    .andExpect(status().isOk())
                    .andReturn())
            .path("id")
            .asLong();

    String before =
        mockMvc
            .perform(
                get("/api/v1/study/sections/pitfalls").header("Authorization", admin.authHeader()))
            .andReturn()
            .getResponse()
            .getContentAsString();

    mockMvc
        .perform(
            post("/api/v1/study/revisions/" + proposalId + "/reject")
                .header("Authorization", admin.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"review_note\":\"理由不充分\"}"))
        .andExpect(status().isOk());

    MvcResult row =
        mockMvc
            .perform(
                get("/api/v1/study/revisions/" + proposalId).header("Authorization", admin.authHeader()))
            .andExpect(status().isOk())
            .andReturn();
    assertThat(json(row).path("status").asText()).isEqualTo("rejected");
    assertThat(json(row).path("review_note").asText()).isEqualTo("理由不充分");
    assertThat(json(row).path("reviewer_username").asText()).isEqualTo(adminUsername(admin));
    assertThat(json(row).path("reviewed_at").isMissingNode()).isFalse();

    // Live content unchanged.
    String after =
        mockMvc
            .perform(
                get("/api/v1/study/sections/pitfalls").header("Authorization", admin.authHeader()))
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(after).isEqualTo(before);
  }

  // ---------- revert (history is never deleted) ----------

  @Test
  void adminRevertRestoresTargetWhileKeepingAllIntermediateVersions() throws Exception {
    Session admin = registerAndLoginAdmin("study_revert");

    long v1Id =
        json(
                mockMvc
                    .perform(
                        post("/api/v1/study/sections/essay-rules/edit")
                            .header("Authorization", admin.authHeader())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body("[{\"title\":\"V1\",\"detail\":\"d\",\"checks\":[]}]", "v1")))
                    .andExpect(status().isOk())
                    .andReturn())
            .path("id")
            .asLong();
    long v2Id =
        json(
                mockMvc
                    .perform(
                        post("/api/v1/study/sections/essay-rules/edit")
                            .header("Authorization", admin.authHeader())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body("[{\"title\":\"V2\",\"detail\":\"d\",\"checks\":[]}]", "v2")))
                    .andExpect(status().isOk())
                    .andReturn())
            .path("id")
            .asLong();

    MvcResult revert =
        mockMvc
            .perform(
                post("/api/v1/study/sections/essay-rules/revert")
                    .header("Authorization", admin.authHeader())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"target_revision_id\":" + v1Id + "}"))
            .andExpect(status().isOk())
            .andReturn();
    long revertId = json(revert).path("id").asLong();
    assertThat(json(revert).path("action").asText()).isEqualTo("revert");
    assertThat(json(revert).path("status").asText()).isEqualTo("published");
    assertThat(json(revert).path("parent_revision_id").asLong()).isEqualTo(v1Id);
    // The revert row's content equals V1's content (snapshot copied).
    assertThat(json(revert).path("content_json").get(0).path("title").asText()).isEqualTo("V1");

    // Live content is back to V1.
    MvcResult live =
        mockMvc
            .perform(
                get("/api/v1/study/sections/essay-rules").header("Authorization", admin.authHeader()))
            .andExpect(status().isOk())
            .andReturn();
    assertThat(json(live).path("content_json").get(0).path("title").asText()).isEqualTo("V1");

    // CRITICAL: both V1 and V2 remain queryable — history is append-only, revert never deletes.
    assertThat(
            mockMvc
                .perform(
                    get("/api/v1/study/revisions/" + v1Id).header("Authorization", admin.authHeader()))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getStatus())
        .isEqualTo(200);
    JsonNode v2 =
        json(
            mockMvc
                .perform(
                    get("/api/v1/study/revisions/" + v2Id).header("Authorization", admin.authHeader()))
                .andExpect(status().isOk())
                .andReturn());
    assertThat(v2.path("status").asText()).isEqualTo("superseded");
    assertThat(v2.path("content_json").get(0).path("title").asText()).isEqualTo("V2");

    // The revert row itself is the new live.
    JsonNode revertRow =
        json(
            mockMvc
                .perform(
                    get("/api/v1/study/revisions/" + revertId).header("Authorization", admin.authHeader()))
                .andExpect(status().isOk())
                .andReturn());
    assertThat(revertRow.path("status").asText()).isEqualTo("published");
  }

  // ---------- authorization ----------

  @Test
  void nonAdminCannotWriteButCanReadAndPropose() throws Exception {
    Session user = registerAndLogin("study_authz");
    long proposalId =
        json(
                mockMvc
                    .perform(
                        post("/api/v1/study/sections/pitfalls/propose")
                            .header("Authorization", user.authHeader())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body("[{\"issue\":\"ok\"}]", null)))
                    .andExpect(status().isOk())
                    .andReturn())
            .path("id")
            .asLong();

    mockMvc
        .perform(get("/api/v1/study/sections").header("Authorization", user.authHeader()))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/v1/study/sections/pitfalls/edit")
                .header("Authorization", user.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("[{\"issue\":\"x\"}]", null)))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            post("/api/v1/study/revisions/" + proposalId + "/approve")
                .header("Authorization", user.authHeader()))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            post("/api/v1/study/revisions/" + proposalId + "/reject")
                .header("Authorization", user.authHeader()))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            post("/api/v1/study/sections/pitfalls/revert")
                .header("Authorization", user.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"target_revision_id\":" + proposalId + "}"))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(get("/api/v1/study/proposals").header("Authorization", user.authHeader()))
        .andExpect(status().isForbidden());
  }

  @Test
  void unauthenticatedRequestsAreRejected() throws Exception {
    mockMvc.perform(get("/api/v1/study/sections")).andExpect(status().isUnauthorized());
  }

  // ---------- author is always server-derived ----------

  @Test
  void clientSuppliedAuthorIsIgnored() throws Exception {
    Session user = registerAndLogin("study_author");
    ObjectNode body = objectMapper.createObjectNode();
    body.set("content_json", objectMapper.readTree("[{\"issue\":\"x\"}]"));
    body.put("change_summary", "s");
    body.put("author_id", 999999L); // attempted forgery — must be ignored

    MvcResult propose =
        mockMvc
            .perform(
                post("/api/v1/study/sections/pitfalls/propose")
                    .header("Authorization", user.authHeader())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body)))
            .andExpect(status().isOk())
            .andReturn();
    long id = json(propose).path("id").asLong();

    MvcResult row =
        mockMvc
            .perform(
                get("/api/v1/study/revisions/" + id).header("Authorization", user.authHeader()))
            .andExpect(status().isOk())
            .andReturn();
    // author_username is the logged-in user, not whoever 999999 would be.
    assertThat(json(row).path("author_username").asText()).isEqualTo(userUsername(user));
  }

  // ---------- content_json validation ----------

  @Test
  void malformedJsonBodyIsRejectedAs400() throws Exception {
    Session admin = registerAndLoginAdmin("study_malformed");
    mockMvc
        .perform(
            post("/api/v1/study/sections/pitfalls/edit")
                .header("Authorization", admin.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content_json\": !!!not json!!!}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void wrongTopLevelTypeIsRejectedAs400() throws Exception {
    Session admin = registerAndLoginAdmin("study_wrongtype");
    // exam-scan expects an ARRAY; an object is structurally invalid.
    mockMvc
        .perform(
            post("/api/v1/study/sections/exam-scan/edit")
                .header("Authorization", admin.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("{\"not\":\"an array\"}", null)))
        .andExpect(status().isBadRequest());
  }

  @Test
  void oversizeContentIsRejectedAs400() throws Exception {
    Session admin = registerAndLoginAdmin("study_oversize");
    String padding = "a".repeat(70_000); // > 64KB once wrapped in the array element
    mockMvc
        .perform(
            post("/api/v1/study/sections/pitfalls/edit")
                .header("Authorization", admin.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("[{\"issue\":\"" + padding + "\"}]", null)))
        .andExpect(status().isBadRequest());
  }

  // ---------- section_key whitelist ----------

  @Test
  void unknownSectionKeyReturns404() throws Exception {
    Session user = registerAndLogin("study_unknown");
    mockMvc
        .perform(get("/api/v1/study/sections/no-such-key").header("Authorization", user.authHeader()))
        .andExpect(status().isNotFound());
    mockMvc
        .perform(
            post("/api/v1/study/sections/no-such-key/propose")
                .header("Authorization", user.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("[{}]", null)))
        .andExpect(status().isNotFound());
  }

  // ---------- state machine conflicts ----------

  @Test
  void approveAndRejectRejectNonProposedWith409() throws Exception {
    // Self-contained: create a proposal, approve it once (it becomes superseded), then a second
    // approve and a reject must both 409 because the row is no longer `proposed`. This avoids any
    // assumption about which global state another test left behind.
    Session proposer = registerAndLogin("study_conflict_user");
    Session admin = registerAndLoginAdmin("study_conflict");
    long proposalId =
        json(
                mockMvc
                    .perform(
                        post("/api/v1/study/sections/pitfalls/propose")
                            .header("Authorization", proposer.authHeader())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body("[{\"issue\":\"state-machine\"}]", null)))
                    .andExpect(status().isOk())
                    .andReturn())
            .path("id")
            .asLong();

    // First approve succeeds (proposal -> superseded, new published created).
    mockMvc
        .perform(
            post("/api/v1/study/revisions/" + proposalId + "/approve")
                .header("Authorization", admin.authHeader()))
        .andExpect(status().isOk());

    // Second approve and reject both 409: the row is no longer `proposed`.
    mockMvc
        .perform(
            post("/api/v1/study/revisions/" + proposalId + "/approve")
                .header("Authorization", admin.authHeader()))
        .andExpect(status().isConflict());
    mockMvc
        .perform(
            post("/api/v1/study/revisions/" + proposalId + "/reject")
                .header("Authorization", admin.authHeader()))
        .andExpect(status().isConflict());
  }

  @Test
  void revertTargetMustExistInSameSection() throws Exception {
    Session admin = registerAndLoginAdmin("study_revert_target");
    long essayId =
        json(
                mockMvc
                    .perform(
                        get("/api/v1/study/sections/essay-rules/revisions")
                            .header("Authorization", admin.authHeader()))
                    .andReturn())
            .path("revisions")
            .get(0)
            .path("id")
            .asLong();
    // Reverting pitfalls to an essay-rules revision -> wrong section -> 409.
    mockMvc
        .perform(
            post("/api/v1/study/sections/pitfalls/revert")
                .header("Authorization", admin.authHeader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"target_revision_id\":" + essayId + "}"))
        .andExpect(status().isConflict());
  }

  // ---------- helpers ----------

  private String body(String contentJson, String summary) throws Exception {
    ObjectNode root = objectMapper.createObjectNode();
    root.set("content_json", objectMapper.readTree(contentJson));
    if (summary != null) {
      root.put("change_summary", summary);
    }
    return objectMapper.writeValueAsString(root);
  }

  private String userUsername(Session session) {
    return userRepository.findById(session.userId()).orElseThrow().username();
  }

  private String adminUsername(Session admin) {
    return userRepository.findById(admin.userId()).orElseThrow().username();
  }

  /** Mirrors RbacContractTests.registerAndLoginAdmin (kept local to avoid editing RBAC tests). */
  private Session registerAndLoginAdmin(String prefix) throws Exception {
    Session session = registerAndLogin(prefix);
    userRepository.updateRole(session.userId(), "admin");
    return session;
  }
}
