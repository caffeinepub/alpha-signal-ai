interface Props {
  children: React.ReactNode;
  requiredRole?: string;
}

export default function ProtectedRoute({ children }: Props) {
  return <>{children}</>;
}
