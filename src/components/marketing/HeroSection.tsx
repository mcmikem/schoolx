'use client'

export function HeroSection() {
  return (
    <section className="py-20 px-6 text-center">
      <h1 className="text-4xl md:text-6xl font-extrabold text-[var(--t1)] tracking-tight mb-6">
        Complete School Visibility, Simplified.
      </h1>
      <p className="text-xl text-[var(--t3)] max-w-2xl mx-auto mb-10">
        The all-in-one operating system for schools that helps you spend less time on admin and more on students.
      </p>
      <div className="flex justify-center gap-4">
        <a href="/login" className="btn btn-primary px-8 py-4 text-base">Start Your 14-Day Free Trial</a>
        <a href="#overview" className="btn btn-ghost px-8 py-4 text-base">Watch Overview</a>
      </div>
    </section>
  )
}
