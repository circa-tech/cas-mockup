import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleAlert, Trash2, X } from "lucide-react";

type ConfirmationOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
};

function ConfirmationDialog({
  request,
  onResolve,
}: {
  request: ConfirmationOptions | null;
  onResolve: (confirmed: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!request || !element) return;
    const previousOverflow = document.body.style.overflow;
    const opener = document.activeElement;
    document.body.style.overflow = "hidden";
    element.showModal();
    cancel.current?.focus();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [request]);
  if (!request) return null;
  const Icon = request.destructive ? Trash2 : CircleAlert;
  return createPortal(
    <dialog
      ref={dialog}
      className="confirmation-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onResolve(false);
      }}
    >
      <div className="confirmation-content">
        <div
          className={`confirmation-icon ${request.destructive ? "is-destructive" : ""}`}
        >
          <Icon size={22} aria-hidden="true" />
        </div>
        <button
          type="button"
          className="confirmation-close"
          aria-label="Cerrar diálogo"
          onClick={() => onResolve(false)}
        >
          <X size={18} />
        </button>
        <h2 id={titleId}>{request.title}</h2>
        <p id={descriptionId}>{request.description}</p>
        <div className="confirmation-actions">
          <button type="button" ref={cancel} onClick={() => onResolve(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className={request.destructive ? "is-destructive" : "is-primary"}
            onClick={() => onResolve(true)}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

export function useConfirmationDialog() {
  const [request, setRequest] = useState<ConfirmationOptions | null>(null);
  const pending = useRef<((confirmed: boolean) => void) | null>(null);
  const confirm = useCallback(
    (options: ConfirmationOptions): Promise<boolean> => {
      // Ignore duplicate triggers while a decision is pending.
      if (pending.current) return Promise.resolve(false);
      return new Promise((resolve) => {
        pending.current = resolve;
        setRequest(options);
      });
    },
    [],
  );
  const resolve = useCallback((confirmed: boolean) => {
    const settle = pending.current;
    pending.current = null;
    setRequest(null);
    settle?.(confirmed);
  }, []);
  useEffect(
    () => () => {
      pending.current?.(false);
      pending.current = null;
    },
    [],
  );
  return {
    confirm,
    confirmationDialog: (
      <ConfirmationDialog request={request} onResolve={resolve} />
    ),
  };
}
