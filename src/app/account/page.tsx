"use client";

import type React from "react";

import { useToast } from "@/hooks/use-toast";
import { AccountAddresses } from "@/src/app/components/account-addresses";
import { AccountOrders } from "@/src/app/components/account-orders";
import { AccountWishlist } from "@/src/app/components/account-wishlist";
import { Button } from "@/src/app/components/ui/button";
import { Input } from "@/src/app/components/ui/input";
import { Label } from "@/src/app/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/app/components/ui/tabs";
import { useAuth } from "@/src/app/context/auth-context";
import { useAsyncData } from "@/src/app/lib/use-async-data";
import {
  fetchUserProfileByEmail,
  isAdminProfile,
  updateUserProfile,
  type UserProfile,
} from "@/src/app/lib/users";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Container } from "@/src/app/components/ui/container";

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Please try again.";

export default function AccountPage() {
  const router = useRouter();
  const { user, signOut, signIn, updatePassword } = useAuth();

  /* Read once: the compiler infers `user` from `user?.email` inside a
     callback, which widens the dependency past what we actually read. */
  const userEmail = user?.email ?? null;
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Profile form state
  /*
   * What the shopper has typed, or null while they have not
   * touched the form. Null means "show the profile", which is
   * why the loaded row does not have to be copied into state:
   * an effect doing that ran a second render every time the
   * profile arrived, and raced anything typed in between.
   */
  const [edits, setEdits] = useState<{
    fullName: string;
    email: string;
    phone: string;
  } | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  /*
   * The `users` row is the profile of record - auth metadata only holds what
   * was passed at signup, so reading it made an edited name reappear as the
   * old one on the next visit.
   */
  const loadProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!userEmail) {
      return null;
    }

    return fetchUserProfileByEmail(userEmail);
  }, [userEmail]);

  const onProfileError = useCallback((error: unknown) => {
    console.error("Error loading profile:", error);
  }, []);

  const { data: profile } = useAsyncData(loadProfile, {
    fallback: null as UserProfile | null,
    enabled: Boolean(userEmail),
    onError: onProfileError,
  });

  /* The profile is the default; edits win once there are any. */
  const formData = edits ?? {
    fullName: profile?.full_name ?? "",
    email: profile?.email ?? userEmail ?? "",
    phone: profile?.phone ?? "",
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    /*
     * The first keystroke promotes the profile's values into
     * edits, so the other fields keep what was on screen.
     */
    setEdits((prev) => ({ ...(prev ?? formData), [name]: value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      return;
    }

    setIsUpdating(true);

    try {
      await updateUserProfile(user.id, {
        fullName: formData.fullName,
        phone: formData.phone,
      });

      toast({
        title: "Profile updated",
        description: "Your profile information has been saved.",
      });
    } catch (error: unknown) {
      console.error("Failed to update profile:", error);

      toast({
        title: "Couldn't update your profile",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userEmail) {
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Re-enter the new password in both fields.",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      /*
       * Supabase changes a password on the session alone, so anyone at an
       * unlocked browser could do it. Re-signing in with the current password
       * is what makes the "Current Password" field mean something.
       */
      const { error: reauthError } = await signIn(userEmail, passwordForm.currentPassword);

      if (reauthError) {
        toast({
          title: "Current password is incorrect",
          description: "Check it and try again.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await updatePassword(passwordForm.newPassword);

      if (error) {
        throw error;
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      toast({
        title: "Password changed",
        description: "Use your new password the next time you sign in.",
      });
    } catch (error: unknown) {
      console.error("Failed to change password:", error);

      toast({
        title: "Couldn't change your password",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
  };

  if (!user) {
    return (
      <Container className="flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
        <h1 className="mb-4 text-3xl font-bold">Account Access</h1>
        <p className="mb-8 text-muted-foreground">Please sign in to access your account.</p>
        <Button onClick={() => router.push("/login?redirect=/account")}>Sign In</Button>
      </Container>
    );
  }

  return (
    <Container className="py-8 md:py-12">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-3xl font-bold">My Account</h1>
        <div className="flex gap-3">
          {/*
            Staff only. The admin area guards itself and the
            tables behind it are closed by RLS, so this was never
            a way in - but offering every customer a button to a
            page that will turn them away is its own kind of
            broken, and it advertises the door.
          */}
          {isAdminProfile(profile) && (
            <Button
              className="bg-brand font-semibold text-brand-foreground hover:bg-brand-strong"
              onClick={() => router.push("/admin")}
            >
              Admin Portal
            </Button>
          )}
          <Button
            variant="outline"
            className="border-neutral-300 text-neutral-600 hover:bg-neutral-50"
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-8">
        <TabsList className="w-full justify-start border-b pb-px">
          <TabsTrigger value="profile" className="rounded-b-none">
            Profile
          </TabsTrigger>
          <TabsTrigger value="orders" className="rounded-b-none">
            Orders
          </TabsTrigger>
          <TabsTrigger value="addresses" className="rounded-b-none">
            Addresses
          </TabsTrigger>
          <TabsTrigger value="wishlist" className="rounded-b-none">
            Wishlist
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-6 text-xl font-semibold">Personal Information</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? "Updating..." : "Update Profile"}
              </Button>
            </form>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-6 text-xl font-semibold">Change Password</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordChange}
                    required
                  />
                </div>
                <div></div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange}
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordChange}
                    minLength={6}
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword ? "Changing…" : "Change Password"}
              </Button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <AccountOrders />
        </TabsContent>

        <TabsContent value="addresses">
          <AccountAddresses />
        </TabsContent>

        <TabsContent value="wishlist">
          <AccountWishlist />
        </TabsContent>
      </Tabs>
    </Container>
  );
}
