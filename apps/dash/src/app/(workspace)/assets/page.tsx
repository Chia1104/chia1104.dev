"use client";

import { ViewTransition, useState } from "react";

import { Card } from "@heroui/react";

import { FileTree } from "@chia/ui/file-tree";
import type { R2ObjectItem } from "@chia/ui/file-tree";

const mockR2Objects: R2ObjectItem[] = [
  // 根目錄檔案
  { key: "README.md", size: 2048 },
  { key: "package.json", size: 1024 },
  { key: "tsconfig.json", size: 512 },
  { key: ".gitignore", size: 256 },

  // images 資料夾
  { key: "images/logo.png", size: 45678 },
  { key: "images/banner.jpg", size: 234567 },
  { key: "images/icon.svg", size: 1234 },
  { key: "images/favicon.ico", size: 15360 },

  // src 資料夾
  { key: "src/index.ts", size: 2048 },
  { key: "src/utils/helper.ts", size: 3072 },
  { key: "src/utils/format.ts", size: 1536 },
  { key: "src/components/Button.tsx", size: 4096 },
  { key: "src/components/Card.tsx", size: 5120 },
  { key: "src/components/Modal.tsx", size: 6144 },
  { key: "src/hooks/useAuth.ts", size: 2560 },
  { key: "src/hooks/useTheme.ts", size: 1792 },

  // public 資料夾
  { key: "public/manifest.json", size: 512 },
  { key: "public/robots.txt", size: 128 },
  { key: "public/assets/fonts/main.woff2", size: 45678 },
  { key: "public/assets/fonts/bold.woff2", size: 52345 },

  // docs 資料夾
  { key: "docs/getting-started.md", size: 8192 },
  { key: "docs/api-reference.md", size: 12288 },
  { key: "docs/guides/tutorial.md", size: 16384 },
  { key: "docs/guides/advanced.md", size: 20480 },

  // tests 資料夾
  { key: "tests/setup.ts", size: 1024 },
  { key: "tests/utils.test.ts", size: 3072 },
  { key: "tests/components/Button.test.tsx", size: 4096 },
  { key: "tests/components/Card.test.tsx", size: 5120 },

  // config 資料夾
  { key: "config/app.config.ts", size: 2048 },
  { key: "config/database.config.ts", size: 1536 },
  { key: "config/env.example", size: 512 },

  // 空資料夾（透過 .keep 檔案）
  { key: "empty-folder/.keep", size: 0 },
  { key: "logs/.keep", size: 0 },

  // 其他檔案類型
  { key: "data/sample.json", size: 4096 },
  { key: "data/users.csv", size: 8192 },
  { key: "assets/video/demo.mp4", size: 10485760 }, // 10MB
  { key: "assets/audio/notification.mp3", size: 524288 }, // 512KB
  { key: "backup/archive.zip", size: 5242880 }, // 5MB
  { key: "reports/monthly.pdf", size: 2097152 }, // 2MB
];

const Pages = () => {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const handleSelect = (path: string) => {
    setSelectedPath(path);
  };

  return (
    <ViewTransition>
      <section className="flex w-full flex-col gap-4 px-4 py-8 md:px-6 lg:px-8">
        <header className="flex w-full items-center justify-between">
          <h2 className="text-2xl font-bold">Assets</h2>
        </header>
        <Card>
          <FileTree
            objects={mockR2Objects}
            selectedPath={selectedPath}
            onSelect={handleSelect}
          />
        </Card>
      </section>
    </ViewTransition>
  );
};

export default Pages;
