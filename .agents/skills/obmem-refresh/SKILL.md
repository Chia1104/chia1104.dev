---
name: obmem-refresh
description: Bring obmem memory notes back in line with the code. Load when memory_audit reports drift, stale notes, broken links or orphans, when a note contradicts code you just read, after a merge or refactor that touched code the notes describe, or when asked to review or clean up memory.
metadata:
  managed-by: obmem setup rewrites this file
---

# Refresh memory

A note is **stale** when the code or the project has moved past what it says. A refresh **settles** every note on the work list: each one ends verified, corrected, reported or left, with a reason.

## Steps

1. **Build the work list.** Call `memory_audit` with `min_severity: "info"`. The notes it names are the work list. When the user named notes or an area, use those instead. Add any note you already know to be wrong.

2. **Check each note against the code.** Read the note with `memory_get`. Read the code each `code_ref` points at as it is now; `git diff <verified_commit> HEAD -- <path>` shows what changed since the note was last verified. Then check every claim in the note:
   - A drift warning says a file changed. It does not say which sentence is wrong, and the wrong sentence is often about something else.
   - Claims with no `code_ref` go stale silently. Look for a branch name, a version, a path, a count, "not yet", "never run", "still to decide".

   The note is checked when each claim is true, false or cannot-tell.

3. **Settle the note.** Take the first case that fits:

   | The note                                                                              | Do                                                                                                                               |
   | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
   | has a false claim, and a person wrote it (`author: human`)                            | It is read-only. Write a `finding` with `memory_write` that names the note by its path, the false claim and what the code shows. |
   | has a false claim, and an agent wrote it                                              | Correct it with `memory_write` and `update_id`, keeping its title and type.                                                      |
   | has a claim you cannot check here (it needs a machine, an account or an app you lack) | Leave it unverified and say so in the report.                                                                                    |
   | is true in every claim                                                                | `memory_verify`.                                                                                                                 |

   When correcting a note:
   - Keep what is still true and change only what is false. The reasons and the rejected alternatives of a decision usually still hold.
   - Keep a dated observation dated, and add the new one beside it.
   - When a later decision replaced part of an older one, say so in the older note and link the newer one.
   - Point `code_refs` at symbols (`path#symbol`) that the corrected text describes.

   `memory_verify` records that you read the code. Call it only for a note you checked in step 2.

4. **Fix the links.** A broken link: point it at the note that exists, or take it out. An orphan: link it from a related note. The project's `Index.md` is the map every session loads, and a person owns it: give the user the lines to add, and edit it yourself only when they have said to.

5. **Audit again.** Run `memory_audit` once more. The refresh is done when it reports nothing for the notes you settled.

6. **Report.** One line per note: verified, corrected (what changed), reported (the finding) or left (why). Then `memory_log` one line with the counts and what is left for a person.
