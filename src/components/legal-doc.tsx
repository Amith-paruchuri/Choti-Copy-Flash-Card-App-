/** Shared styling shell for the Terms / Privacy pages. */
export function LegalDoc({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-muted-foreground text-xs">Last updated {updated}</p>
      </header>

      <p className="border-rule bg-muted/30 text-muted-foreground rounded-lg border p-3 text-sm">
        {intro}
      </p>

      <div className="[&_h2]:font-display space-y-6 text-sm leading-relaxed [&_a]:underline [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:my-1 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h2>{heading}</h2>
      {children}
    </section>
  );
}
