// frontend/pages/login.js
import LoginForm from "../components/LoginForm";

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(to right, #1428A0, #000000)" }}
    >
      <LoginForm />
    </div>
  );
}
