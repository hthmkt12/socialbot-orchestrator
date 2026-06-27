import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Header from '../components/layout/Header';
import Spinner from '../components/ui/Spinner';
import { ChevronRight } from 'lucide-react';

interface DocSection {
  id: string;
  title: string;
  file: string;
}

interface DocCategory {
  id: string;
  title: string;
  sections: DocSection[];
}

export default function DocsPage() {
  const [manifest, setManifest] = useState<DocCategory[] | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/user-docs/manifest.json')
      .then(res => res.json())
      .then(data => {
        setManifest(data);
        if (data.length > 0 && data[0].sections.length > 0) {
          setActiveFile(data[0].sections[0].file);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeFile) return;
    setIsLoading(true);
    fetch(activeFile)
      .then(res => res.text())
      .then(text => {
        setMarkdownContent(text);
        setIsLoading(false);
      })
      .catch(err => {
        setMarkdownContent('Failed to load documentation. Please try again later.');
        setIsLoading(false);
        console.error(err);
      });
  }, [activeFile]);

  return (
    <>
      <Header
        title="Documentation"
        subtitle="Learn how to configure devices, automate accounts, and manage the platform."
      />

      <div className="flex-1 overflow-hidden flex">
        {/* Navigation Sidebar */}
        <div className="w-64 border-r border-gray-200 bg-gray-50/50 flex flex-col overflow-y-auto">
          {manifest ? (
            <div className="p-4 space-y-6">
              {manifest.map(category => (
                <div key={category.id}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {category.title}
                  </h3>
                  <div className="space-y-1">
                    {category.sections.map(section => (
                      <button
                        key={section.id}
                        onClick={() => setActiveFile(section.file)}
                        className={`w-full flex items-center justify-between text-sm px-3 py-2 rounded-lg transition-colors ${
                          activeFile === section.file
                            ? 'bg-sky-100 text-sky-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        {section.title}
                        {activeFile === section.file && <ChevronRight className="w-4 h-4 opacity-50" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex justify-center p-8"><Spinner size="sm" /></div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-white">
          {isLoading ? (
            <div className="flex justify-center p-16"><Spinner size="lg" /></div>
          ) : (
            <div className="max-w-3xl mx-auto py-12 px-8 prose prose-sky prose-h1:text-2xl prose-h1:font-bold prose-h2:text-xl prose-h2:font-semibold prose-a:text-sky-600">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {markdownContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
