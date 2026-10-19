export default function JsonView({ data }: { data: unknown }) {
  return (
    <pre className="m-0 max-h-[480px] overflow-auto border border-zinc-800 bg-black p-4 text-xs leading-relaxed text-zinc-400">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}
