import Swal from "sweetalert2";

/** Shared SweetAlert styling for queue checkout and related game dialogs. */
export const swalAlertBaseOptions = {
  background: "#0f172a",
  color: "#e2e8f0",
  confirmButtonColor: "#22c55e",
  cancelButtonColor: "#ef4444",
} as const;

export function selfQueueCheckoutMessageHtml(playerName: string) {
  return `<strong>${playerName}</strong>, you will be checked out of the queue, but your registration and match history are kept.`;
}

export async function confirmSelfQueueCheckoutSwal(playerName: string) {
  const result = await Swal.fire({
    ...swalAlertBaseOptions,
    title: "Check out?",
    html: selfQueueCheckoutMessageHtml(playerName),
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes, check out",
    cancelButtonText: "Cancel",
  });

  return result.isConfirmed;
}
