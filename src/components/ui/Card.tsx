"use client";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = "", onClick, ...rest }: CardProps) {
  return (
    <div {...rest} className={`card ${onClick ? "cursor-pointer" : ""} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-header ${className}`}>{children}</div>;
}

export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-body ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-title ${className}`}>{children}</div>;
}

export function CardSubtitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-sub ${className}`}>{children}</div>;
}
