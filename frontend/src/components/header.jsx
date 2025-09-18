import {
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function Header() {
    return (
        <header className="flex items-center justify-between p-1 border-b border-muted">
                <SidebarTrigger/>
        </header>
    )
}