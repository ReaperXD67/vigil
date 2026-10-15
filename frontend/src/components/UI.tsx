import { type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, Plus } from "lucide-react";
import { label } from "../api";
export function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${value}`}>
      <i />
      {label(value)}
    </span>
  );
}
export function Empty({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-orbit" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="button secondary" onClick={onAction}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}
export function Modal({
  title,
  description,
  open,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className={`dialog-content ${wide ? "wide" : ""}`}>
          <Dialog.Title className="dialog-title">{title}</Dialog.Title>
          <Dialog.Description
            className={description ? "dialog-description" : "sr-only"}
          >
            {description ?? "Manage your workspace."}
          </Dialog.Description>
          <Dialog.Close
            className="icon-button dialog-close"
            aria-label="Close dialog"
          >
            <X size={19} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Submit({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <button type="submit" className="button primary" disabled={busy}>
      {busy ? (
        <>
          <Loader2 size={16} className="spin" /> Saving…
        </>
      ) : (
        children
      )}
    </button>
  );
}
export function Bars({
  warning = false,
  small = false,
}: {
  warning?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`uptime-bars ${small ? "small" : ""}`}
      aria-label="Illustrative sample check history"
    >
      {Array.from({ length: small ? 20 : 45 }, (_, i) => (
        <i key={i} className={warning && i > 28 && i < 34 ? "warning" : ""} />
      ))}
    </div>
  );
}
