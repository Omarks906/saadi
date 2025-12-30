import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-semibold">Create better car listings faster</h1>
        <p className="mt-3 text-lg text-gray-600">
          Clean car photos and generate ad text — ready to copy and post.
        </p>
        <div className="mt-8">
          <Link
            className="inline-flex items-center rounded-xl bg-black text-white px-5 py-3"
            href="/new"
          >
            Create a listing
          </Link>
        </div>
      </div>
    </main>
  );
}
