"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  requestEmailChange,
  updateDisplayName,
  updatePassword,
} from "@/actions/account";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function ProfilePanel({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const router = useRouter();

  // ── name ──────────────────────────────────────────────────────────────
  const [name, setName] = useState(initialName);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(initialName);
  const [savingName, startName] = useTransition();

  function saveName() {
    startName(async () => {
      const res = await updateDisplayName(draftName);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setName(draftName.trim());
      setEditingName(false);
      toast.success("Name updated.");
      router.refresh();
    });
  }

  // ── email ─────────────────────────────────────────────────────────────
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, startEmail] = useTransition();

  function saveEmail() {
    startEmail(async () => {
      const res = await requestEmailChange(newEmail);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEmailOpen(false);
      setNewEmail("");
      toast.success("Check your new inbox for a confirmation link.");
    });
  }

  // ── password ──────────────────────────────────────────────────────────
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [savingPw, startPw] = useTransition();

  function savePassword() {
    if (pw.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (pw !== pwConfirm) {
      toast.error("The two passwords don’t match.");
      return;
    }
    startPw(async () => {
      const res = await updatePassword(pw);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPwOpen(false);
      setPw("");
      setPwConfirm("");
      toast.success("Password updated.");
    });
  }

  return (
    <div className="divide-border divide-y">
      <Row label="Name">
        {editingName ? (
          <>
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={80}
              autoFocus
              className="h-8 w-44"
            />
            <Button size="xs" onClick={saveName} disabled={savingName}>
              {savingName ? "Saving…" : "Save"}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setDraftName(name);
                setEditingName(false);
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm font-medium">
              {name || <span className="text-muted-foreground">Not set</span>}
            </span>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setDraftName(name);
                setEditingName(true);
              }}
            >
              Edit
            </Button>
          </>
        )}
      </Row>

      <Row label="Email">
        <span className="text-sm font-medium">{email}</span>
        <Button size="xs" variant="ghost" onClick={() => setEmailOpen(true)}>
          Change
        </Button>
      </Row>

      <Row label="Password">
        <Button size="xs" variant="ghost" onClick={() => setPwOpen(true)}>
          Change password
        </Button>
      </Row>

      {/* email dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change email</DialogTitle>
            <DialogDescription>
              We’ll send a confirmation link to the new address. Your email
              changes only after you click it.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveEmail();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="new-email">New email</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingEmail}>
                {savingEmail ? "Sending…" : "Send confirmation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* password dialog */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              savePassword();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="pw">New password</Label>
              <Input
                id="pw"
                type="password"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                minLength={8}
                required
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw2">Confirm new password</Label>
              <Input
                id="pw2"
                type="password"
                autoComplete="new-password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingPw}>
                {savingPw ? "Saving…" : "Update password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
