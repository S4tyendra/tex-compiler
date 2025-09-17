import {
  TreeExpander,
  TreeIcon,
  TreeLabel,
  TreeNode,
  TreeNodeContent,
  TreeNodeTrigger,
  TreeProvider,
  TreeView,
} from "@/components/ui/kibo-ui/tree";
import { FileCode, FileJson, FileText, FileType } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useState } from "react";

export function FilesNavigation({ ...props }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const handleClearSelection = () => {
    setSelectedIds([]);
  };
  return (
    <Sidebar {...props}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Files</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <TreeProvider
                defaultExpandedIds={[]}
                onSelectionChange={(ids) => {setSelectedIds(ids); console.log("Selected:", ids)}}
                multiSelect
                selectedIds={selectedIds}
              >
                <TreeView>
                  <TreeNode nodeId="assets">
                    <TreeNodeTrigger>
                      <TreeExpander hasChildren />
                      <TreeIcon hasChildren />
                      <TreeLabel>assets</TreeLabel>
                    </TreeNodeTrigger>
                    <TreeNodeContent hasChildren>
                      <TreeNode isLast level={1} nodeId="images">
                        <TreeNodeTrigger>
                          <TreeExpander hasChildren />
                          <TreeIcon hasChildren />
                          <TreeLabel>images</TreeLabel>
                        </TreeNodeTrigger>
                        <TreeNodeContent hasChildren>
                          <TreeNode level={2} nodeId="logo.svg">
                            <TreeNodeTrigger>
                              <TreeExpander />
                              <TreeIcon icon={<FileText className="h-4 w-4" />} />
                              <TreeLabel>logo.svg</TreeLabel>
                            </TreeNodeTrigger>
                          </TreeNode>
                          <TreeNode isLast level={2} nodeId="hero.png">
                            <TreeNodeTrigger>
                              <TreeExpander />
                              <TreeIcon icon={<FileText className="h-4 w-4" />} />
                              <TreeLabel>hero.png</TreeLabel>
                            </TreeNodeTrigger>
                          </TreeNode>
                        </TreeNodeContent>
                      </TreeNode>
                    </TreeNodeContent>
                  </TreeNode>
                  <TreeNode nodeId="ref.bib">
                    <TreeNodeTrigger>
                      <TreeExpander />
                      <TreeIcon icon={<FileJson className="h-4 w-4" />} />
                      <TreeLabel>ref.bib</TreeLabel>
                    </TreeNodeTrigger>
                  </TreeNode>
                  <TreeNode isLast nodeId="main.tex">
                    <TreeNodeTrigger>
                      <TreeExpander />
                      <TreeIcon icon={<FileText className="h-4 w-4" />} />
                      <TreeLabel>main.tex</TreeLabel>
                    </TreeNodeTrigger>
                  </TreeNode>
                </TreeView>
              </TreeProvider>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}