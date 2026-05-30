import { getDeviceLabelFromRequest } from "@/lib/device-from-request";
import { User } from "@/models/User";

export async function recordUserLogin(userId: string, request: Request) {
  const device = getDeviceLabelFromRequest(request);
  await User.findByIdAndUpdate(userId, {
    $set: {
      lastLoginAt: new Date(),
      lastLoginDevice: device,
    },
  });
}

export function getRegistrationDevice(request: Request) {
  return getDeviceLabelFromRequest(request);
}
