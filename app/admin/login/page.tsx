import { login } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Please enter both your email and password.",
  invalid_credentials: "Invalid email or password.",
  unauthorized: "That account doesn't have Admin access.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold">mktbd admin</h1>
        <p className="mt-1 text-sm text-muted">Sign in to continue.</p>

        <form action={login} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="border border-light-grey px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="border border-light-grey px-3 py-2 text-sm"
            />
          </div>

          {errorMessage ? (
            <p role="alert" className="text-sm text-red-600">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            className="mt-2 bg-black py-2 text-sm font-medium text-white"
          >
            Log in
          </button>
        </form>
      </div>
    </div>
  );
}
