"use client";

import { useState, useTransition } from "react";
import { addExistingMember, createInvite, removeMember, revokeInvite, updateMember } from "@/app/projects/actions";
import type { Invite, TeamMember } from "@/lib/data";
import { shortDate } from "@/lib/dates";
import { Field, FormMessage, SubmitButton, inputClass, useFormAction } from "@/components/ui/forms";

// Suggested roles for team members; "Custom…" lets you type any role
const ROLES = ["Designer", "Drafter", "Project Manager", "Engineer", "Consultant", "Contractor", "Intern"];

export default function TeamManager({
  projectId,
  projectName,
  members,
  invites,
  currentUserId,
}: {
  projectId: string;
  projectName: string;
  members: TeamMember[];
  invites: Invite[];
  currentUserId: string;
}) {
  const pending = invites.filter((i) => i.waiting);
  const used = invites.filter((i) => i.used_at);

  return (
    <div className="flex flex-col gap-14">
      {/* Current team */}
      <section>
        <h2 className="text-2xl font-medium">Team</h2>
        <p className="mb-5 mt-1 text-moa-muted">
          Only the people listed here can see {projectName}. <strong className="font-medium text-moa-text">Admins</strong> see budgets,
          everyone&apos;s hours and settings. <strong className="font-medium text-moa-text">Team members</strong> only log and see their own hours.
        </p>
        <ul className="border-t border-moa-line">
          {members.map((m) => (
            <MemberRow key={`${m.user_id}-${m.access}-${m.role_name}`} projectId={projectId} member={m} isMe={m.user_id === currentUserId} />
          ))}
        </ul>
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        <AddExisting projectId={projectId} />
        <NewInvite projectId={projectId} />
      </div>

      {/* Invites */}
      {(pending.length > 0 || used.length > 0) && (
        <section>
          <h2 className="mb-4 text-2xl font-medium">Invites</h2>
          <ul className="border-t border-moa-line">
            {pending.map((i) => (
              <InviteRow key={i.id} invite={i} />
            ))}
            {used.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-moa-line py-3 text-sm text-moa-muted">
                <span>
                  <span className="font-mono tracking-widest">{i.code}</span>
                  <span className="ml-3">{i.access === "admin" ? "Admin" : i.role_name || "Team member"}</span>
                </span>
                <span>
                  Used by {i.used_by_name ?? "someone"} on {shortDate(i.used_at!.slice(0, 10), true)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
function AccessAndRole({ access: initialAccess, role }: { access: "admin" | "member"; role: string | null }) {
  const [access, setAccess] = useState(initialAccess);
  const isPreset = !role || ROLES.includes(role);
  const [choice, setChoice] = useState(isPreset ? role ?? "" : "__custom");

  return (
    <>
      <Field label="Access">
        <select name="access" value={access} onChange={(e) => setAccess(e.target.value as "admin" | "member")} className={`${inputClass} h-11`}>
          <option value="member">Team member: logs hours</option>
          <option value="admin">Admin: full access</option>
        </select>
      </Field>
      <Field label="Role on this project">
        <select name="role_name" value={choice} onChange={(e) => setChoice(e.target.value)} className={`${inputClass} h-11`}>
          <option value="">{access === "admin" ? "None" : "Choose…"}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          <option value="__custom">Custom…</option>
        </select>
      </Field>
      {choice === "__custom" && (
        <Field label="Custom role">
          <input name="custom_role" required defaultValue={isPreset ? "" : role ?? ""} placeholder="Site observer" className={`${inputClass} h-11`} />
        </Field>
      )}
    </>
  );
}

function MemberRow({ projectId, member: m, isMe }: { projectId: string; member: TeamMember; isMe: boolean }) {
  const [editing, setEditing] = useState(false);
  const { state, pending, onSubmit } = useFormAction(updateMember);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  return (
    <li className="border-b border-moa-line py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-lg font-medium">
            {m.name}
            {isMe && <span className="ml-2 text-sm font-normal text-moa-muted">(you)</span>}
          </p>
          <p className="truncate text-sm text-moa-muted">{m.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className={`border px-2.5 py-1 text-sm ${m.access === "admin" ? "border-moa-text" : "border-moa-line text-moa-muted"}`}>
            {m.access === "admin" ? "Admin" : "Team member"}
            {m.role_name && <span className="ml-2 text-moa-muted">{m.role_name}</span>}
          </span>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-sm text-moa-muted hover:text-moa-text">
              Change
            </button>
          )}
          {!isMe && !editing && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!confirm(`Remove ${m.name} from this project? Their hours stay, but they won't see the project any more.`)) return;
                startTransition(async () => setRemoveError((await removeMember(projectId, m.user_id)).error));
              }}
              className="text-sm text-moa-muted hover:text-moa-text"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {removeError && <p className="mt-2 text-sm text-red-300">{removeError}</p>}
      {editing && (
        <form onSubmit={onSubmit} className="mt-4 grid items-end gap-5 sm:grid-cols-3">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="user_id" value={m.user_id} />
          <AccessAndRole access={m.access} role={m.role_name} />
          <div className="flex items-center gap-3 sm:col-span-3">
            <SubmitButton pending={pending}>Save</SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-moa-muted hover:text-moa-text">
              Cancel
            </button>
            <FormMessage state={state} />
          </div>
        </form>
      )}
    </li>
  );
}

function AddExisting({ projectId }: { projectId: string }) {
  const { state, pending, onSubmit } = useFormAction(addExistingMember);
  const [formKey, setFormKey] = useState(0);
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok) setFormKey((k) => k + 1);
  }

  return (
    <section>
      <h3 className="text-xl font-medium">Add someone with an account</h3>
      <p className="mb-5 mt-1 text-sm text-moa-muted">They&apos;ll see this project the next time they open the app.</p>
      <form key={formKey} onSubmit={onSubmit} className="flex flex-col gap-5">
        <input type="hidden" name="project_id" value={projectId} />
        <Field label="Their email">
          <input name="email" type="email" required className={`${inputClass} h-11`} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <AccessAndRole access="member" role={null} />
        </div>
        <div className="flex items-center gap-4">
          <SubmitButton pending={pending} pendingText="Adding…">
            Add to team
          </SubmitButton>
          <FormMessage state={state} />
        </div>
      </form>
    </section>
  );
}

function NewInvite({ projectId }: { projectId: string }) {
  const { state, pending, onSubmit } = useFormAction(createInvite);
  const [formKey, setFormKey] = useState(0);
  const [created, setCreated] = useState<string | null>(null);
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok && state.id) {
      setCreated(state.id);
      setFormKey((k) => k + 1);
    }
  }

  return (
    <section>
      <h3 className="text-xl font-medium">Invite someone new</h3>
      <p className="mb-5 mt-1 text-sm text-moa-muted">
        Creates a one-time code. They enter it when creating their account, and get this access and role. Codes last 30 days.
      </p>

      {created && <InviteLink code={created} onDone={() => setCreated(null)} />}

      <form key={formKey} onSubmit={onSubmit} className="flex flex-col gap-5">
        <input type="hidden" name="project_id" value={projectId} />
        <div className="grid gap-5 sm:grid-cols-2">
          <AccessAndRole access="member" role={null} />
        </div>
        <Field label="Their email" hint="Optional, just so you remember who it's for.">
          <input name="email" type="email" className={`${inputClass} h-11`} />
        </Field>
        <div className="flex items-center gap-4">
          <SubmitButton pending={pending} pendingText="Creating…">
            Create invite
          </SubmitButton>
          <FormMessage state={state.ok ? { error: null } : state} />
        </div>
      </form>
    </section>
  );
}

function InviteLink({ code, onDone }: { code: string; onDone?: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const link = typeof window !== "undefined" ? `${window.location.origin}/signup?code=${code}` : `/signup?code=${code}`;

  const copy = async (what: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="mb-6 border border-moa-text p-4">
      <p className="text-sm text-moa-muted">Send them this link. The code is filled in for them.</p>
      <p className="mt-2 break-all font-medium">{link}</p>
      <p className="mt-3 text-sm text-moa-muted">
        Code <span className="font-mono text-base tracking-widest text-moa-text">{code}</span>
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => copy("link", link)} className="h-10 border border-moa-text px-4 text-sm font-semibold hover:bg-moa-text hover:text-moa-bg">
          {copied === "link" ? "Link copied" : "Copy link"}
        </button>
        <button type="button" onClick={() => copy("code", code)} className="h-10 border border-moa-line px-4 text-sm hover:border-moa-text">
          {copied === "code" ? "Code copied" : "Copy code"}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className="h-10 px-2 text-sm text-moa-muted hover:text-moa-text">
            Done
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-moa-muted">Already have an account? They can enter the code on their Account page instead.</p>
    </div>
  );
}

function InviteRow({ invite: i }: { invite: Invite }) {
  const [showLink, setShowLink] = useState(false);
  const [busy, startTransition] = useTransition();
  return (
    <li className="border-b border-moa-line py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          <span className="font-mono tracking-widest">{i.code}</span>
          <span className="ml-3">{i.access === "admin" ? "Admin" : i.role_name || "Team member"}</span>
          {i.email && <span className="ml-3 text-sm text-moa-muted">{i.email}</span>}
        </span>
        <span className="flex items-center gap-4 text-sm text-moa-muted">
          <span>Waiting, expires {shortDate(i.expires_at.slice(0, 10))}</span>
          <button type="button" onClick={() => setShowLink((v) => !v)} className="hover:text-moa-text">
            {showLink ? "Hide link" : "Show link"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => confirm("Cancel this invite? The code will stop working.") && startTransition(() => revokeInvite(i.id))}
            className="hover:text-moa-text"
          >
            Cancel invite
          </button>
        </span>
      </div>
      {showLink && (
        <div className="mt-3">
          <InviteLink code={i.code} />
        </div>
      )}
    </li>
  );
}
