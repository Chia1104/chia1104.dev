---
name: obmem
description: Project and personal memory through obmem's memory_* tools. Load to search what past sessions decided or learned, to record a decision, a non-obvious fact, a procedure or the user's feedback as a note, or to act on a finding.
metadata:
  managed-by: obmem setup rewrites this file
---

# obmem

Memory is two vaults of Obsidian notes that people review. The **project vault** is the team's: in the repo and shared through git, or a private folder outside the repo. The **personal vault** is this user's, for every project.

The routine is two calls: `memory_context` before a task, `memory_log` before finishing. This skill is everything between.

## Recall

Matching is literal. A note is found by the words it holds, in the language it was written in, so one call often misses notes. Recall is a search you repeat until it finds nothing new.

1. **Start** with `memory_context` and the task description.
2. **Read what the answer says about itself:**
   - `matches:` lists the task's words a note holds, the rarest first. A note that holds only common words is probably about something else.
   - `no note contains:` names the parts of the task that are in no note. When one of them belongs to a subject of the task, memory has not been searched for that subject yet. Text written without spaces is cut into pieces, so a part can be a fragment of a word (器誤報): read it for the subject it came from.
   - `One link away` lists notes linked with the best matches.
3. **Search again** with `memory_search` for each subject that step 2 left unsearched. Use other words for it: a synonym, the name the code uses, and the notes' language when the task is in another one (備份 → backup). The titles of the project's notes show their language. When the answer lists none, the session's start context or `[[Index]]` does.
4. **Read** with `memory_get` each note the task depends on. Its first line lists `links:` and `backlinks:`. Follow the ones that bear on the task.
5. **Stop** when the last search and the last note you read named no note you have not seen. Say that memory has nothing on a subject only after step 3 searched for it in the notes' language.

`memory_search` takes Obsidian search syntax: words are ANDed, `OR` for alternatives, `tag:`, `path:`, `-exclude`. Its results are unranked, so search for specific words. Search for bare words: `token` also finds `tokens`, and `"token"` may not.

`[[Index]]` is the map of every note in the project vault. Read it with `memory_get` when the searches find nothing and you need to see what there is.

Prefer what a note says over re-deriving it. A `draft` note is unreviewed: check it before relying on it.

## Record

Record what a future session could not learn from the code or the git history. One idea per note, linked to related notes with `[[note-id]]`.

| Type                     | Holds                                                                  | Vault    |
| ------------------------ | ---------------------------------------------------------------------- | -------- |
| `decision`               | what was chosen and why, the alternatives considered, the consequences | project  |
| `fact`, `architecture`   | non-obvious behaviour of the system                                    | project  |
| `procedure`              | steps that took effort to work out                                     | project  |
| `feedback`, `preference` | how the user wants agents to work                                      | personal |

- Search before you write. When a note on the idea exists, replace it with `update_id`.
- Feedback and preferences are the user's guidance in every project. When one holds in this project only (a convention of this repo, how its branches, reviews or releases work), pass `this_project_only: true`: it is then listed in this project's sessions and in no other. What the user wants everywhere, such as the language of replies, goes without it. When you cannot tell, pass it: the user widens a note, and an agent does not.
- Give a note about code its `code_refs`, as `path#symbol`. The audit uses them to notice when the code moved on. Name the symbol: a whole-file ref is flagged by every commit to that file.
- Date an observation that can expire: "Checked on 2026-11-10 with Obsidian 1.14".
- A note a person wrote is read-only. To disagree with it, write a `finding` that names it.
- Keep secrets and one-off task details out. A write that holds a secret is refused.

## Log

`memory_log` is the session log: one to three lines on what was done, what is left, and what the next session must know. The log is for handing over. Knowledge that should last goes in a note.

## Keep notes true

- You read the code a note describes and the note is still true: `memory_verify`.
- You fixed what a finding reports, or it is real and stays open: `memory_resolve` with `fixed` or `accepted`. Rejecting a finding is for a person.
- A note disagrees with the code, or `memory_audit` reports problems: the `obmem-refresh` skill.
