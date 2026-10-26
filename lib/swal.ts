import type { SweetAlertOptions, SweetAlertResult } from "sweetalert2";

type SwalModule = typeof import("sweetalert2").default;

let swalPromise: Promise<SwalModule> | null = null;
let swalLoaded: SwalModule | null = null;

function loadSwal() {
  swalPromise ??= import("sweetalert2").then((mod) => {
    swalLoaded = mod.default;
    return swalLoaded;
  });
  return swalPromise;
}

/**
 * Drop-in lazy facade for SweetAlert2 so the library stays out of page bundles until a dialog opens.
 * `close` / `showLoading` queue behind the load, so they still run after a `fire` that started first.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors the library signature `fire<T = any>`
const Swal = {
  async fire<T = any>(options: SweetAlertOptions): Promise<SweetAlertResult<Awaited<T>>> {
    const swal = await loadSwal();
    return swal.fire(options) as Promise<SweetAlertResult<Awaited<T>>>;
  },
  async close(result?: Parameters<SwalModule["close"]>[0]) {
    (await loadSwal()).close(result);
  },
  async showLoading() {
    (await loadSwal()).showLoading();
  },
  /** Only meaningful while a dialog is open, i.e. after the library has loaded. */
  isLoading() {
    return swalLoaded?.isLoading() ?? false;
  },
  showValidationMessage(message: string) {
    swalLoaded?.showValidationMessage(message);
  },
  DismissReason: {
    cancel: "cancel",
    backdrop: "backdrop",
    close: "close",
    esc: "esc",
    timer: "timer",
  },
} as const;

export default Swal;
