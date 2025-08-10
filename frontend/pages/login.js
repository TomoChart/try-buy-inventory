export default function Login() {
  return <div>Login Page</div>;
}
// unutar handleSubmit
localStorage.setItem('session', JSON.stringify({ role:'superadmin', country:'HR' }));
window.location.href = '/dashboard';
