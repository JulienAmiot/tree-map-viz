import { TreeGraphScreen } from "./adapters/ui/TreeGraphScreen.js";
import { buildSampleTree } from "./adapters/sampleData.js";

const sample = buildSampleTree();

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Tree view</h1>
        <p>Tap a child card to zoom into that node. Use &quot;Back to parent&quot; to zoom out.</p>
      </header>
      <main className="app-main">
        <TreeGraphScreen root={sample} />
      </main>
    </div>
  );
}
