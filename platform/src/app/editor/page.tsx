import Header from "@/components/Header";
import NotationEditor from "@/components/NotationEditor";

export const metadata = {
  title: "Notation Editor | Songbook",
  description: "Create and edit sargam notations with live preview",
};

export default function EditorPage() {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex-1 overflow-hidden">
        <NotationEditor />
      </div>
    </div>
  );
}
