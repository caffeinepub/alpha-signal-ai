import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export default function SignupPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/" });
  }, [navigate]);
  return null;
}
