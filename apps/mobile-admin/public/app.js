const state = {
  token: sessionStorage.getItem("memory-admin-access-token") || "",
  headSha: "",
  proposal: null
};
const $ = (selector) => document.querySelector(selector);
const status = $("#status");

function setStatus(message, kind = "") {
  status.textContent = message;
  status.className = `status ${kind}`;
}

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${state.token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  }).then(async (response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const fingerprint = body.error?.diagnostic?.workerTokenFingerprint;
      const suffix = fingerprint ? `（Worker token fingerprint: ${fingerprint}）` : "";
      throw new Error(`${body.error?.message || "通信に失敗しました。"}${suffix}`);
    }
    return body;
  });
}

function proposalCard(proposal) {
  const button = document.createElement("button");
  button.className = "proposal-card";
  button.type = "button";
  const label = document.createElement("p");
  label.className = "eyebrow";
  label.textContent = proposal.type;
  const title = document.createElement("h3");
  title.textContent = proposal.summary;
  const meta = document.createElement("p");
  meta.className = "proposal-meta";
  [
    proposal.proposedAction,
    proposal.targetPath,
    proposal.riskLevel === "high" ? "高リスク" : "通常"
  ].forEach((value, index) => {
    const tag = document.createElement("span");
    tag.className = `tag ${index === 2 && proposal.riskLevel === "high" ? "high" : ""}`;
    tag.textContent = value;
    meta.append(tag);
  });
  button.append(label, title, meta);
  button.addEventListener("click", () => openProposal(proposal.id));
  return button;
}

function humanSummary(proposal) {
  const labels = {
    project: "プロジェクトの概要",
    "project-state": "プロジェクトの現在地",
    session: "作業セッションの記録",
    knowledge: "再利用できる知識",
    goal: "目標"
  };
  const type = labels[proposal.frontmatter.type] || "長期記憶";
  const action = proposal.frontmatter.proposedAction === "create" ? "新しく記録" : "更新";
  const reason = proposal.frontmatter.reason || "将来の作業で参照できるよう残す候補です。";
  const reviewBlock = /^## 人間向け要約\s*\n([\s\S]*?)(?=\n##\s|$)/m.exec(proposal.body)?.[1];
  const source = reviewBlock || proposal.body;
  const highlights = source
    .split("\n")
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter((line) => line && !line.startsWith("#"))
    .slice(0, 4);
  return {
    text: `これは「${type}」として、${proposal.frontmatter.targetPath} に${action}する候補です。${reason}`,
    highlights
  };
}

async function refresh() {
  setStatus("Vaultを更新しています…");
  const data = await api("/api/dashboard");
  state.headSha = data.headSha;
  $("#pending-count").textContent = String(data.pendingCount);
  $("#head-sha").textContent = data.headSha.slice(0, 12);
  const list = $("#proposal-list");
  list.replaceChildren();
  if (data.proposals.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "承認待ちの候補はありません。";
    list.append(empty);
  } else data.proposals.forEach((proposal) => list.append(proposalCard(proposal)));
  setStatus(`最終取得: ${new Date().toLocaleTimeString("ja-JP")}`, "success");
}

async function openProposal(id) {
  try {
    setStatus("候補を取得しています…");
    const data = await api(`/api/proposals/${encodeURIComponent(id)}`);
    state.headSha = data.headSha;
    state.proposal = data.proposal;
    $("#proposal-type").textContent =
      `${data.proposal.frontmatter.type} / ${data.proposal.frontmatter.proposedAction}`;
    $("#proposal-title").textContent = data.proposal.frontmatter.summary;
    const explanation = humanSummary(data.proposal);
    $("#proposal-human-summary").textContent = explanation.text;
    const highlights = $("#proposal-highlights");
    highlights.replaceChildren();
    explanation.highlights.forEach((highlight) => {
      const item = document.createElement("li");
      item.textContent = highlight;
      highlights.append(item);
    });
    const meta = $("#proposal-meta");
    meta.replaceChildren();
    [
      ["対象", data.proposal.frontmatter.targetPath],
      ["リスク", data.proposal.frontmatter.riskLevel],
      ["出典", data.proposal.frontmatter.source.join(", ")],
      ["作成", data.proposal.frontmatter.proposalCreatedAt]
    ].forEach(([key, value]) => {
      const dt = document.createElement("dt");
      dt.textContent = key;
      const dd = document.createElement("dd");
      dd.textContent = value;
      meta.append(dt, dd);
    });
    $("#proposal-diff").textContent = data.diff;
    const highRisk = data.proposal.frontmatter.riskLevel === "high";
    $("#risk-acknowledgement").classList.toggle("hidden", !highRisk);
    $("#risk-checkbox").checked = false;
    $("#proposal-dialog").showModal();
    setStatus("差分を確認してから操作してください。");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

async function mutate(action) {
  const proposal = state.proposal;
  if (!proposal) return;
  const highRisk = proposal.frontmatter.riskLevel === "high";
  const acknowledgement = $("#risk-checkbox").checked;
  if (action === "approve" && highRisk && !acknowledgement) {
    setStatus("高リスク変更の確認チェックが必要です。", "error");
    return;
  }
  let body = { expectedHeadSha: state.headSha, acknowledgeHighRisk: acknowledgement };
  if (action === "reject") {
    const reason = prompt("却下理由を記録します（3文字以上）");
    if (reason === null) return;
    body = { expectedHeadSha: state.headSha, reason };
  }
  try {
    setStatus(action === "approve" ? "承認を反映しています…" : "候補を却下しています…");
    await api(`/api/proposals/${encodeURIComponent(proposal.frontmatter.id)}/${action}`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    $("#proposal-dialog").close();
    state.proposal = null;
    await refresh();
  } catch (error) {
    setStatus(error.message, "error");
  }
}

$("#refresh-button").addEventListener("click", () =>
  refresh().catch((error) => setStatus(error.message, "error"))
);
$("#close-proposal").addEventListener("click", () => $("#proposal-dialog").close());
$("#approve-button").addEventListener("click", () => mutate("approve"));
$("#reject-button").addEventListener("click", () => mutate("reject"));
$("#inbox-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    setStatus("Inboxへ保存しています…");
    const formData = new FormData(form);
    await api("/api/inbox", {
      method: "POST",
      body: JSON.stringify({
        expectedHeadSha: state.headSha,
        title: formData.get("title"),
        content: formData.get("content"),
        source: formData.get("source")
      })
    });
    form.reset();
    $("#inbox-source").value = "mobile-admin";
    await refresh();
  } catch (error) {
    setStatus(error.message, "error");
  }
});
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  state.token = $("#access-token").value;
  try {
    await api("/api/health");
    sessionStorage.setItem("memory-admin-access-token", state.token);
    $("#login-dialog").close();
    await refresh();
  } catch (error) {
    state.token = "";
    setStatus(error.message, "error");
  }
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
if (state.token)
  refresh().catch(() => {
    $("#login-dialog").showModal();
  });
else $("#login-dialog").showModal();
