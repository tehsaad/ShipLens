import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation/limits";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPendingPasswordChange: true });

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="sr-only">Change password</h1>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            {user.mustChangePassword
              ? "Set a new password before you continue."
              : "Choose a new password for your account."}{" "}
            Use at least {PASSWORD_MIN_LENGTH} characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
