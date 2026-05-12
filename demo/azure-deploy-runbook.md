# Azure deploy off-camera runbook

This is the operator's checklist for the off-camera Azure provisioning that backs Steps 11 and 12 of the Data Exposed recording. It is distinct from the audience-facing instructions in `README.md` (which describe the reproducer flow): this file is for **you** before tape rolls.

## When to run this

T-3h to T-1h on recording day. The cloud stack must be live, warm, and verified by T-15min.

## What you need before starting

- An Azure subscription with Owner or Contributor on the target resource group's scope.
- `az` CLI 2.60+ and `azd` 1.10+ installed, OR Azure Cloud Shell.
- VS Code with GitHub Copilot subscription active. The `microsoft/azure-skills` plugin is **not** installed manually; the agent installs it as task 0.
- Repo on branch **`002-azure-deploy`**, working tree clean, latest from origin.
- A Copilot Chat session that you will save (do NOT clear history mid-run; the on-camera scroll uses this transcript).

## Step 0: authenticate

```bash
az login                                  # interactive browser auth
az account set --subscription "<id-or-name>"
azd auth login                            # azd has its own cache
```

Confirm the subscription you intend to bill against:

```bash
az account show -o table
```

## Step 1: branch hygiene

```bash
cd /Users/carlos/scout-talk-app
git switch 002-azure-deploy
git pull --rebase origin 002-azure-deploy
git status                                # must be clean
git log --oneline -5                      # confirm the openspec scaffolding commit is present
```

## Step 2: run `/opsx-propose` in Copilot Chat

Open VS Code on this branch. Open GitHub Copilot Chat (agent mode). Type:

```
/opsx-propose add-azure-deployment Deploy TalkScout to Azure Container Apps with Azure SQL Database (free tier) and a sibling Ollama container for embeddings (same nomic-embed-text 768-dim model as local). Use system-assigned managed identity for app to DB. The agentic deployment depends on the microsoft/azure-skills plugin; installing it is the first task in tasks.md.
```

Expected: a new directory `openspec/changes/add-azure-deployment/` with `proposal.md`, `design.md`, `tasks.md`, and `.openspec.yaml`. Review each file. Reject and rerun if the constraints in `openspec/config.yaml` are violated (e.g., proposal suggests Azure OpenAI as primary, or proposes a paid SQL tier).

Commit when satisfied:

```bash
git add openspec/changes/add-azure-deployment/
git commit -m "feat(openspec): /opsx-propose add-azure-deployment"
git push origin 002-azure-deploy
```

## Step 3: run `/opsx-apply` in Copilot Chat

In the SAME Copilot Chat session (do not clear it):

```
/opsx-apply add-azure-deployment
```

The agent reads `tasks.md` and executes in order. Expected tasks:

- **Task 0**: install `microsoft/azure-skills` plugin (`/plugin install azure@claude-plugins-official`).
- **Tasks 1-N (code)**: agent creates `src/lib/embed-ollama.ts`, refactors `src/lib/embed.ts` into a dispatcher, adds `Dockerfile`, `.dockerignore`, `.env.production.example`, sets `output: 'standalone'` in `next.config.ts`, updates `package.json`. Approve each gate.
- **Task N+1 (`azure-prepare`)**: agent invokes the skill with the architecture spec as context. Expected output: `.azure/deployment-plan.md`, `azure.yaml`, `infra/main.bicep` (or equivalent). Review carefully; spot-check that the Bicep contains:
  - One Resource Group
  - One Container Apps environment
  - Two Container App revisions: `talkscout-web` (external ingress 3000) and `talkscout-ollama` (internal ingress 11434, runs `ollama pull nomic-embed-text` at startup, has a readinessProbe)
  - One Azure SQL Database on the **free offer** (serverless General Purpose)
  - One Container Apps Job for first-deploy `prisma migrate deploy && npm run db:seed`
  - System-assigned managed identity on `talkscout-web` with `db_datareader + db_datawriter` granted (and `db_owner` for the seed Job's identity, if separate)
- **Task N+2 (`azure-validate`)**: fix any blockers it reports.
- **Task N+3 (`azure-deploy`)**: kicks off `azd up`. ~5 minutes on cold start.

Pause between each task to inspect what landed in the repo, then approve.

After `azure-deploy` completes:

```bash
git add azure.yaml infra/ .azure/
git add src/lib/embed-ollama.ts src/lib/embed-azure-openai.ts 2>/dev/null
git add Dockerfile .dockerignore .env.production.example
git add src/lib/embed.ts next.config.ts package.json package-lock.json
git commit -m "feat(cloud): /opsx-apply add-azure-deployment + azure-skills deploy"
git push origin 002-azure-deploy
```

## Step 4: verify the live URL

The `azure-deploy` output prints the live URL. Hit it:

```bash
curl -sI "https://<live-url>/"
# expect: HTTP/2 200
```

In a browser, navigate to the URL and run the two scripted searches:

- `agentic workflows for databases` → top result should be semantically related to AI agents / MCP / autonomous tooling
- `type safety across the stack` → top result should be tRPC-flavored or end-to-end TypeScript

**If anything 500s, fix now. Do not record on a broken cloud stack.**

The first request after a long idle pauses the free-tier SQL DB and may take 30-60s to resume. **Pre-warm 5 minutes before tape** by hitting `/` a few times so the recording starts on a warm DB.

## Step 5: confirm `$0` spend

```bash
RG=<your-rg-name>
az consumption usage list \
  --start-date "$(date -u -v-1d +%Y-%m-%dT00:00:00Z)" \
  --end-date   "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -g "$RG" \
  -o table
```

Expected: zero billed line items. If you see anything, identify the resource (SKU upgrade somewhere?) and either tear it down or accept the cost (and update the on-camera voiceover).

## Step 6: capture the chat transcript state

The on-camera scroll in Step 11 uses your Copilot Chat history on this branch. Do NOT clear the chat. Do NOT close the VS Code window for this branch until after the recording.

Optionally, scroll the chat from top to bottom once to confirm everything is reachable, then scroll back to the top so the camera starts on the `/opsx-propose` prompt.

## Step 7: pre-recording merge gate (T-2h)

Decision: does the Azure beat ship in tomorrow's recording?

**Ships if and only if:**
- Step 4 verification passed (cloud URL responds 200 and both searches return sensible results)
- Step 5 confirmed `$0` spend
- Local stack still works on `002-azure-deploy` (run `npm run demo:reset` and confirm)
- Copilot Chat transcript on this branch contains the full propose → apply → deploy chain

If all four hold:

```bash
# Fast-forward 002 into 001
git switch 001-talkscout
git merge --ff-only 002-azure-deploy
git push origin 001-talkscout

# Move the pre-implement tag to the new HEAD
git tag -f pre-implement
git push origin pre-implement --force
```

Now `001-talkscout` carries the Azure work and the recording uses one branch end-to-end.

If any of the four fail, **do not merge**. Record from `001-talkscout` unchanged (8-min flow). Add `demo/azure-deploy-runbook.md` to the post-recording follow-up list.

## Step 8: pre-warm checklist (T-15min)

Last thing before tape:

```bash
# Local stack ready
npm run demo:reset
# Wait for "Demo reset complete in Ns"

# Cloud stack warm
open "https://<live-url>/"
# Click into search. Type any query. Wait for results to render. Close tab.
# Repeat once or twice to keep the SQL DB warm and the Ollama sidecar
# pre-loaded.
```

You are ready to record.

## What to remember during the take

- Step 11 voiceover: emphasize "task zero" (the plugin install) — that is the single most important agentic-affordance beat.
- Step 12 voiceover: emphasize "$0" and "no Azure OpenAI quota required". These are the two reproducibility differentiators.
- If anything cloud-side breaks mid-take, the script.md operator notes section has the fallback (cut to a saved screenshot and keep talking).

## Teardown after the recording

You can leave the cloud stack running (it's free) for follow-up usage, OR tear it down:

```bash
azd down --force --purge
```

`--purge` is important to clean up the Azure SQL Database fully and avoid any lingering resources.
