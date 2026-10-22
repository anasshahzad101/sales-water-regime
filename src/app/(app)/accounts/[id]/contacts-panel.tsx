"use client";

import { useState, useTransition } from "react";
import { deleteContact, restoreContact, saveContact } from "@/app/actions/accounts";
import { Icon } from "@/components/ui/icon";
import { FieldError } from "@/components/ui/kit";
import { ConfirmDialog, Drawer } from "@/components/ui/overlay";
import { VerifiedPill } from "@/components/ui/pills";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { initials, telHref, whatsappHref } from "@/lib/format";

export type ContactView = {
  id: number;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  linkedin: string | null;
  isPrimary: boolean;
  verified: boolean;
};

type Form = { name: string; title: string; phone: string; email: string; linkedin: string; isPrimary: boolean; verified: boolean };
const EMPTY: Form = { name: "", title: "", phone: "+92 ", email: "", linkedin: "", isPrimary: false, verified: false };

const action =
  "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-line-strong bg-surface text-[13.5px] font-semibold text-ink hover:bg-surface-2 hover:text-ink hover:no-underline md:h-9";

export function ContactsPanel({ companyId, companyName, contacts, canEdit }: { companyId: number; companyName: string; contacts: ContactView[]; canEdit: boolean }) {
  const toast = useToast();
  const [drawer, setDrawer] = useState<{ id: number | null } | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<ContactView | null>(null);
  const [busy, start] = useTransition();

  const open = (c: ContactView | null) => {
    setErrors({});
    setForm(
      c
        ? { name: c.name, title: c.title ?? "", phone: c.phone ?? "", email: c.email ?? "", linkedin: c.linkedin ?? "", isPrimary: c.isPrimary, verified: c.verified }
        : EMPTY,
    );
    setDrawer({ id: c?.id ?? null });
  };

  const save = () => {
    if (!form.name.trim()) return setErrors({ name: "Enter a name." });
    const editing = drawer?.id ?? null;
    start(async () => {
      const res = await saveContact({ companyId, contactId: editing, ...form });
      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        else toast({ title: "Couldn’t save the contact", sub: res.error, tone: "error" });
        return;
      }
      setDrawer(null);
      toast({ title: editing ? "Contact updated" : "Contact added", sub: res.data?.name });
    });
  };

  const remove = () => {
    const c = confirm;
    if (!c) return;
    start(async () => {
      const res = await deleteContact(c.id);
      setConfirm(null);
      if (!res.ok) return toast({ title: "Couldn’t delete the contact", sub: res.error, tone: "error" });
      const snap = res.data!;
      toast({
        title: "Contact deleted",
        sub: c.name,
        undo: async () => {
          const u = await restoreContact(snap);
          if (!u.ok) toast({ title: "Couldn’t undo", sub: u.error, tone: "error" });
        },
      });
    });
  };

  const field = (key: keyof Form, label: string, ph: string, type = "text") => (
    <label key={key} className="flex flex-col gap-1.5">
      <span className="text-[13.5px] font-semibold">{label}</span>
      <input
        type={type}
        value={form[key] as string}
        onChange={(e) => {
          setForm((f) => ({ ...f, [key]: e.target.value }));
          setErrors({});
        }}
        placeholder={ph}
        autoComplete="off"
        className={cn(
          "wr-field h-12 w-full min-w-0 rounded-xl border bg-input px-3 text-base text-ink outline-none placeholder:text-text-3 md:h-11 md:text-[14.5px]",
          errors[key] ? "border-red" : "border-line-strong",
        )}
      />
      {errors[key] && <FieldError>{errors[key]}</FieldError>}
    </label>
  );

  return (
    <section className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2.5 pt-4 pr-4 pb-3 pl-5">
        <h2 className="m-0 font-display text-[17px] font-semibold">Contacts</h2>
        <span className="text-[13px] text-text-3">{contacts.length}</span>
        {canEdit && (
          <button
            type="button"
            onClick={() => open(null)}
            className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-full border-0 bg-transparent px-3 text-[13.5px] font-semibold text-link hover:bg-surface-2 md:h-[34px]"
          >
            <Icon name="user-plus" size={15} />
            Add contact
          </button>
        )}
      </div>
      {contacts.map((c) => (
        <div key={c.id} className="flex flex-col gap-3 border-t border-line pt-3.5 pr-4 pb-4 pl-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 flex-none items-center justify-center rounded-full bg-bg-alt text-[13px] font-bold text-text-2">
              {initials(c.name.replace(/^(Dr|Engr|Mr|Ms|Mrs)\.?\s+/i, ""))}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[14.5px] font-semibold">{c.name}</span>
                {c.isPrimary && (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-brand-soft px-[7px] text-[11.5px] font-bold text-green">
                    <Icon name="star" size={11} />
                    Primary
                  </span>
                )}
              </span>
              {c.title && <span className="text-[13px] text-text-2">{c.title}</span>}
              <span className="mt-0.5 flex flex-wrap items-center gap-2">
                <VerifiedPill verified={c.verified} />
                {c.phone && <span className="text-[12.5px] text-text-3 tabular-nums">{c.phone}</span>}
              </span>
            </div>
            {canEdit && (
              <span className="flex flex-none gap-0.5">
                <button
                  type="button"
                  onClick={() => open(c)}
                  aria-label={`Edit ${c.name}`}
                  className="flex size-11 items-center justify-center rounded-full border-0 bg-transparent text-text-2 hover:bg-surface-2 md:size-9"
                >
                  <Icon name="pencil" size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm(c)}
                  aria-label={`Delete ${c.name}`}
                  className="flex size-11 items-center justify-center rounded-full border-0 bg-transparent text-red hover:bg-red-bg md:size-9"
                >
                  <Icon name="trash-2" size={16} />
                </button>
              </span>
            )}
          </div>
          {(c.phone || c.email || c.linkedin) && (
            <div className="flex gap-2">
              {c.phone && (
                <a href={telHref(c.phone)} className={action}>
                  <Icon name="phone" size={15} className="text-green" />
                  Call
                </a>
              )}
              {c.phone && (
                <a href={whatsappHref(c.phone)} target="_blank" rel="noopener noreferrer" className={action}>
                  <Icon name="message-circle" size={15} className="text-green" />
                  WhatsApp
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className={action}>
                  <Icon name="mail" size={15} className="text-green" />
                  Email
                </a>
              )}
              {c.linkedin && (
                <a
                  href={c.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn profile"
                  className="flex size-11 flex-none items-center justify-center rounded-full border border-line-strong bg-surface text-text-2 hover:bg-surface-2 hover:text-ink md:size-9"
                >
                  <Icon name="linkedin" size={15} />
                </a>
              )}
            </div>
          )}
        </div>
      ))}
      {contacts.length === 0 && (
        <div className="border-t border-line px-5 pt-4 pb-5 text-sm leading-normal text-text-2">No contacts yet. Add the people you meet so the team can reach them in one tap.</div>
      )}

      <Drawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        title={drawer?.id ? "Edit contact" : "Add contact"}
        description={companyName}
        width={440}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDrawer(null)}
              className="h-[50px] flex-1 rounded-full border border-line-strong bg-surface text-[14.5px] font-semibold text-ink hover:bg-surface-2 md:h-11"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full border-0 bg-primary text-[14.5px] font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60 md:h-11"
            >
              {busy && <Icon name="loader-circle" size={16} className="animate-spin" />}
              {drawer?.id ? "Save changes" : "Add contact"}
            </button>
          </>
        }
      >
        <form
          className="flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {field("name", "Name *", "Full name")}
          {field("title", "Title", "e.g. Plant Manager")}
          {field("phone", "Phone", "+92 300 0000 000", "tel")}
          {field("email", "Email", "name@company.pk", "email")}
          {field("linkedin", "LinkedIn", "linkedin.com/in/…")}
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, isPrimary: !f.isPrimary }))}
            aria-pressed={form.isPrimary}
            className="flex min-h-11 items-center gap-2.5 border-0 bg-transparent p-0 text-left text-[14.5px] text-ink"
          >
            <span className={cn("flex size-[22px] items-center justify-center rounded-[7px] border-[1.5px] text-on-primary", form.isPrimary ? "border-primary bg-primary" : "border-line-strong bg-input")}>
              <Icon name="check" size={14} style={{ opacity: form.isPrimary ? 1 : 0 }} />
            </span>
            Primary contact for this company
          </button>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Details</span>
            <div className="flex rounded-full border border-line bg-bg-alt p-[3px]">
              {(
                [
                  [true, "Verified", "badge-check"],
                  [false, "To confirm", "circle-help"],
                ] as const
              ).map(([v, label, icon]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={form.verified === v}
                  onClick={() => setForm((f) => ({ ...f, verified: v }))}
                  className={cn(
                    "flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-full border-0 text-[13.5px] font-semibold",
                    form.verified === v ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "bg-transparent text-text-2",
                  )}
                >
                  <Icon name={icon} size={14} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </Drawer>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        busy={busy}
        title={`Delete ${confirm?.name ?? "contact"}?`}
        description={`This removes them from ${companyName}. Past visits keep their name. The deletion is recorded in the audit log.`}
        confirmLabel="Delete contact"
      />
    </section>
  );
}
