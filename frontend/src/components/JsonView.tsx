export default function JsonView({ data }: { data: unknown }) {
  return <pre className="json mono">{JSON.stringify(data, null, 2)}</pre>
}
