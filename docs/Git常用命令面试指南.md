# Git 常用命令面试指南

## 目录
- [基础配置](#基础配置)
- [仓库初始化与克隆](#仓库初始化与克隆)
- [基本工作流](#基本工作流)
- [分支管理](#分支管理)
- [远程仓库操作](#远程仓库操作)
- [查看历史与差异](#查看历史与差异)
- [撤销与回退](#撤销与回退)
- [标签管理](#标签管理)
- [暂存工作区](#暂存工作区)
- [实用技巧](#实用技巧)
- [面试常见场景](#面试常见场景)

---

## 基础配置

### 配置用户信息
```bash
# 全局配置用户名和邮箱（首次使用必须配置）
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# 查看配置
git config --list

# 查看特定配置
git config user.name
```

### 配置别名（提高效率）
```bash
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
```

---

## 仓库初始化与克隆

### 初始化新仓库
```bash
# 在项目目录下初始化 Git 仓库
cd react-playground
git init
```

### 克隆远程仓库
```bash
# 克隆完整项目
git clone https://github.com/username/react-playground.git

# 克隆并重命名本地目录
git clone https://github.com/username/react-playground.git my-playground

# 只克隆特定分支
git clone -b develop https://github.com/username/react-playground.git
```

---

## 基本工作流

### 查看状态
```bash
# 查看当前工作区状态
git status

# 简洁输出
git status -s
```

**示例输出解释：**
```
M  src/App.tsx              # 已修改，已暂存
 M src/main.tsx             # 已修改，未暂存
?? docs/新文档.md           # 未跟踪的新文件
```

### 添加文件到暂存区
```bash
# 添加特定文件
git add src/App.tsx

# 添加整个目录
git add src/ReactPlayground/components/

# 添加所有修改的文件
git add .

# 添加所有 .tsx 文件
git add *.tsx

# 交互式添加（可选择性添加）
git add -p
```

**实际场景：**
```bash
# 修改了多个组件后，只提交 CodeEditor 相关的改动
git add src/ReactPlayground/components/CodeEditor/
git commit -m "feat: 优化 CodeEditor 代码高亮功能"
```

### 提交更改
```bash
# 提交暂存区的文件
git commit -m "feat: 添加 AI 助手功能"

# 添加并提交（跳过 git add）
git commit -am "fix: 修复预览组件的样式问题"

# 详细提交信息（打开编辑器）
git commit

# 修改最后一次提交
git commit --amend
```

**规范的提交信息格式：**
```bash
git commit -m "feat: 实现代码编辑器语法高亮"
git commit -m "fix: 修复 Preview 组件内存泄漏"
git commit -m "docs: 更新项目文档"
git commit -m "style: 统一代码格式"
git commit -m "refactor: 重构文件存储逻辑"
git commit -m "test: 添加单元测试"
git commit -m "chore: 更新依赖版本"
```

---

## 分支管理

### 查看分支
```bash
# 查看本地分支
git branch

# 查看所有分支（包括远程）
git branch -a

# 查看分支及最后一次提交
git branch -v
```

### 创建与切换分支
```bash
# 创建新分支
git branch feature/ai-assistant

# 切换到分支
git checkout feature/ai-assistant

# 创建并切换（常用）
git checkout -b feature/code-editor

# 新语法（推荐）
git switch feature/ai-assistant
git switch -c feature/new-feature
```

**实际场景：**
```bash
# 开发新功能：添加深色模式
git checkout -b feature/dark-mode

# 在分支上开发
# 修改 src/ReactPlayground/stores/themeStore.ts
git add src/ReactPlayground/stores/themeStore.ts
git commit -m "feat: 添加深色模式支持"
```

### 合并分支
```bash
# 切换到主分支
git checkout main

# 合并功能分支
git merge feature/ai-assistant

# 不使用 fast-forward 模式（保留分支历史）
git merge --no-ff feature/ai-assistant

# 解决冲突后继续合并
git merge --continue
```

**实际场景（合并冲突处理）：**
```bash
# 合并时出现冲突
git merge feature/code-editor
# Auto-merging src/App.tsx
# CONFLICT (content): Merge conflict in src/App.tsx

# 1. 查看冲突文件
git status

# 2. 手动编辑冲突文件
# 在 src/App.tsx 中选择保留的代码

# 3. 标记冲突已解决
git add src/App.tsx

# 4. 完成合并
git commit -m "merge: 合并 code-editor 分支"
```

### 删除分支
```bash
# 删除已合并的分支
git branch -d feature/ai-assistant

# 强制删除未合并的分支
git branch -D feature/abandoned-feature

# 删除远程分支
git push origin --delete feature/old-feature
```

### 变基（Rebase）
```bash
# 将当前分支变基到 main
git rebase main

# 交互式变基（整理提交历史）
git rebase -i HEAD~3

# 解决冲突后继续
git rebase --continue

# 放弃变基
git rebase --abort
```

---

## 远程仓库操作

### 查看远程仓库
```bash
# 查看远程仓库
git remote -v

# 显示远程仓库详细信息
git remote show origin
```

### 添加远程仓库
```bash
# 添加远程仓库
git remote add origin https://github.com/username/react-playground.git

# 修改远程仓库地址
git remote set-url origin https://github.com/username/new-repo.git
```

### 推送代码
```bash
# 推送到远程分支
git push origin main

# 首次推送并关联远程分支
git push -u origin main

# 推送所有分支
git push --all

# 强制推送（慎用）
git push -f origin main

# 推送标签
git push origin v1.0.0
git push --tags
```

**实际场景：**
```bash
# 完成功能开发后推送
git checkout -b feature/preview-optimization
# ... 开发代码 ...
git add .
git commit -m "feat: 优化 Preview 组件渲染性能"
git push -u origin feature/preview-optimization
```

### 拉取代码
```bash
# 拉取并合并
git pull origin main

# 拉取但不合并
git fetch origin

# 拉取所有远程分支
git fetch --all

# 拉取并变基
git pull --rebase origin main
```

**pull 与 fetch 的区别：**
```bash
# git pull = git fetch + git merge
git pull origin main

# 等价于
git fetch origin
git merge origin/main
```

---

## 查看历史与差异

### 查看提交历史
```bash
# 查看提交历史
git log

# 单行显示
git log --oneline

# 图形化显示分支
git log --graph --oneline --all

# 查看最近 5 条
git log -5

# 查看某个文件的历史
git log src/App.tsx

# 查看某人的提交
git log --author="Your Name"

# 查看某个时间段的提交
git log --since="2 weeks ago"
git log --after="2024-01-01" --before="2024-12-31"
```

**实用的 log 格式：**
```bash
git log --pretty=format:"%h - %an, %ar : %s"
# 输出：a1b2c3d - John Doe, 2 days ago : feat: 添加新功能
```

### 查看差异
```bash
# 查看工作区与暂存区的差异
git diff

# 查看暂存区与最后一次提交的差异
git diff --staged
# 或
git diff --cached

# 查看特定文件的差异
git diff src/App.tsx

# 比较两个分支
git diff main feature/ai-assistant

# 比较两次提交
git diff commit1 commit2

# 查看统计信息
git diff --stat
```

**实际场景：**
```bash
# 修改了 CodeEditor 组件，查看具体改动
git diff src/ReactPlayground/components/CodeEditor/index.tsx

# 查看即将提交的内容
git add .
git diff --staged
```

---

## 撤销与回退

### 撤销工作区的修改
```bash
# 撤销单个文件的修改
git checkout -- src/App.tsx

# 撤销所有修改
git checkout -- .

# 新语法（推荐）
git restore src/App.tsx
git restore .
```

### 撤销暂存区的文件
```bash
# 取消暂存（文件仍在工作区）
git reset HEAD src/App.tsx

# 新语法（推荐）
git restore --staged src/App.tsx
```

### 撤销提交
```bash
# 撤销最后一次提交，保留修改
git reset --soft HEAD~1

# 撤销最后一次提交，修改放回工作区
git reset --mixed HEAD~1
# 或简写
git reset HEAD~1

# 撤销最后一次提交，完全删除修改（危险）
git reset --hard HEAD~1

# 回退到指定提交
git reset --hard a1b2c3d
```

**三种 reset 模式的区别：**
```bash
# --soft: 仅移动 HEAD，保留暂存区和工作区
git reset --soft HEAD~1
# 结果：提交被撤销，但改动仍在暂存区

# --mixed（默认）: 移动 HEAD，重置暂存区，保留工作区
git reset HEAD~1
# 结果：提交被撤销，改动回到工作区（未暂存）

# --hard: 全部重置（危险！会丢失修改）
git reset --hard HEAD~1
# 结果：提交被撤销，所有改动都丢失
```

### Revert（创建新提交来撤销）
```bash
# 撤销指定提交（保留历史）
git revert a1b2c3d

# 撤销最近的提交
git revert HEAD

# 撤销多个提交
git revert HEAD~3..HEAD
```

**reset vs revert：**
- `reset`: 改写历史，适合本地未推送的提交
- `revert`: 创建新提交，适合已推送的提交（不改写历史）

---

## 标签管理

### 查看标签
```bash
# 列出所有标签
git tag

# 查看特定标签
git show v1.0.0
```

### 创建标签
```bash
# 轻量标签
git tag v1.0.0

# 附注标签（推荐）
git tag -a v1.0.0 -m "发布版本 1.0.0"

# 给历史提交打标签
git tag -a v0.9.0 a1b2c3d -m "版本 0.9.0"
```

### 推送和删除标签
```bash
# 推送单个标签
git push origin v1.0.0

# 推送所有标签
git push --tags

# 删除本地标签
git tag -d v1.0.0

# 删除远程标签
git push origin --delete v1.0.0
```

---

## 暂存工作区

### 使用 stash
```bash
# 暂存当前修改
git stash

# 暂存并添加描述
git stash save "修改了 AI 助手功能"

# 查看暂存列表
git stash list

# 应用最近的暂存（保留 stash）
git stash apply

# 应用并删除最近的暂存
git stash pop

# 应用指定的暂存
git stash apply stash@{2}

# 删除暂存
git stash drop stash@{0}

# 清空所有暂存
git stash clear
```

**实际场景：**
```bash
# 正在开发功能时，需要紧急修复 bug
git stash save "开发中：代码编辑器自动补全"

# 切换到主分支修 bug
git checkout main
git checkout -b hotfix/preview-crash
# ... 修复 bug ...
git commit -m "fix: 修复预览组件崩溃问题"
git checkout main
git merge hotfix/preview-crash

# 回到功能分支，恢复工作
git checkout feature/auto-complete
git stash pop
```

---

## 实用技巧

### 查找包含特定内容的提交
```bash
# 搜索提交信息
git log --grep="AI"

# 搜索代码内容变化
git log -S"optimizedAI"

# 搜索某个函数的修改历史
git log -L :handleSubmit:src/ReactPlayground/components/AIAssistant/index.tsx
```

### 查看文件的每行最后修改人
```bash
git blame src/App.tsx

# 指定行范围
git blame -L 10,20 src/App.tsx
```

### 清理未跟踪的文件
```bash
# 查看会删除哪些文件（预览）
git clean -n

# 删除未跟踪的文件
git clean -f

# 删除未跟踪的文件和目录
git clean -fd

# 连同 .gitignore 中的文件一起删除
git clean -fX
```

### 子模块管理
```bash
# 添加子模块
git submodule add https://github.com/example/library.git libs/library

# 克隆包含子模块的项目
git clone --recursive https://github.com/username/react-playground.git

# 更新子模块
git submodule update --init --recursive
```

### Cherry-pick（挑选特定提交）
```bash
# 将其他分支的某个提交应用到当前分支
git cherry-pick a1b2c3d

# 挑选多个提交
git cherry-pick a1b2c3d b2c3d4e
```

---

## 面试常见场景

### 场景1：误提交敏感信息（如 API Key）
```bash
# 问题：不小心提交了 .env 文件
git add .
git commit -m "feat: 添加 AI 功能"
# 糟糕！.env 包含 API Key

# 解决方案：
# 方法1：如果还没推送
git reset --soft HEAD~1
git restore --staged .env
echo ".env" >> .gitignore
git add .gitignore
git commit -m "feat: 添加 AI 功能"

# 方法2：如果已经推送（需要改写历史）
git rm --cached .env
git commit --amend
git push -f origin main  # 需要团队沟通
```

### 场景2：合并分支时出现冲突
```bash
# 1. 尝试合并
git checkout main
git merge feature/ai-assistant
# CONFLICT in src/App.tsx

# 2. 查看冲突文件
git status

# 3. 编辑 src/App.tsx，会看到：
<<<<<<< HEAD
// main 分支的代码
=======
// feature/ai-assistant 分支的代码
>>>>>>> feature/ai-assistant

# 4. 手动解决冲突，删除标记，保留需要的代码

# 5. 标记为已解决
git add src/App.tsx

# 6. 完成合并
git commit -m "merge: 合并 AI 助手功能，解决 App.tsx 冲突"
```

### 场景3：需要修改已推送的提交信息
```bash
# 错误的提交：
git commit -m "fix bug"
git push origin main

# 修改最后一次提交信息（需要 force push）
git commit --amend -m "fix: 修复 Preview 组件渲染问题"
git push -f origin main

# 注意：如果其他人已经拉取，会造成问题！
```

### 场景4：回退已发布的版本
```bash
# 不好的方式（改写历史）：
git reset --hard HEAD~3
git push -f origin main  # 危险！

# 好的方式（使用 revert）：
git revert HEAD~3..HEAD
git push origin main  # 安全，保留历史
```

### 场景5：临时保存工作切换分支
```bash
# 正在开发功能，突然需要修 bug
git stash save "WIP: 开发 CodeEditor 自动保存功能"
git checkout -b hotfix/urgent-fix
# ... 修复 bug ...
git checkout feature/auto-save
git stash pop
```

### 场景6：查看某个功能是谁写的
```bash
# 查看 AIAssistant 组件的作者
git log src/ReactPlayground/components/AIAssistant/index.tsx

# 查看每行代码的作者
git blame src/ReactPlayground/components/AIAssistant/index.tsx
```

### 场景7：找回删除的文件
```bash
# 误删文件后找回
git checkout HEAD -- src/App.tsx

# 如果已经提交，查找删除记录
git log --all --full-history -- src/App.tsx
# 找到删除前的提交 hash，如 a1b2c3d
git checkout a1b2c3d -- src/App.tsx
```

### 场景8：整理提交历史
```bash
# 将最近3次提交合并为1次
git rebase -i HEAD~3

# 在编辑器中：
# pick a1b2c3d feat: 添加 AI 基础功能
# squash b2c3d4e fix: 修复 AI 响应问题
# squash c3d4e5f refactor: 优化 AI 代码

# 结果：3次提交合并为1次
```

---

## Git 工作流程图

```
工作区 (Working Directory)
  ↓  git add
暂存区 (Staging Area)
  ↓  git commit
本地仓库 (Local Repository)
  ↓  git push
远程仓库 (Remote Repository)
```

---

## 常用 Git 别名配置

```bash
# 添加到 ~/.gitconfig 或使用命令配置
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.unstage 'reset HEAD --'
git config --global alias.last 'log -1 HEAD'
git config --global alias.lg "log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"
```

---

## 面试问答要点

### Q1: Git 的三个区域是什么？
**A:** 
- **工作区 (Working Directory)**: 实际编辑的文件目录
- **暂存区 (Staging Area)**: 通过 `git add` 添加的待提交文件
- **版本库 (Repository)**: 通过 `git commit` 提交的历史记录

### Q2: git pull 和 git fetch 的区别？
**A:**
- `git fetch`: 只下载远程更新，不合并
- `git pull`: 下载并自动合并 (`fetch + merge`)
- 推荐先 `fetch` 查看变化，再手动 `merge`

### Q3: git merge 和 git rebase 的区别？
**A:**
- `git merge`: 保留所有历史，创建合并提交
- `git rebase`: 变基，使历史呈线性，更整洁
- 原则：**公共分支用 merge，个人分支用 rebase**

### Q4: git reset 的三种模式？
**A:**
- `--soft`: 只移动 HEAD，保留暂存区和工作区
- `--mixed` (默认): 重置暂存区，保留工作区
- `--hard`: 全部重置（危险！会丢失修改）

### Q5: 如何解决合并冲突？
**A:**
1. `git status` 查看冲突文件
2. 编辑文件，选择保留的代码
3. 删除冲突标记 (`<<<<<<<`, `=======`, `>>>>>>>`)
4. `git add` 标记已解决
5. `git commit` 完成合并

### Q6: 如何回退已推送的错误提交？
**A:**
- **推荐**: 使用 `git revert` (创建反向提交，不改写历史)
- **不推荐**: 使用 `git reset + force push` (会影响团队成员)

---

## 结合本项目的实际工作流

### 开发新功能：深色模式
```bash
# 1. 创建功能分支
git checkout -b feature/dark-mode

# 2. 开发过程
# 修改 src/ReactPlayground/stores/themeStore.ts
git add src/ReactPlayground/stores/themeStore.ts
git commit -m "feat: 添加主题状态管理"

# 修改 src/ReactPlayground/components/Header/index.tsx
git add src/ReactPlayground/components/Header/
git commit -m "feat: 添加主题切换按钮"

# 修改样式文件
git add src/ReactPlayground/index.scss
git commit -m "style: 添加深色模式样式"

# 3. 更新文档
git add docs/README.md
git commit -m "docs: 更新深色模式使用说明"

# 4. 推送到远程
git push -u origin feature/dark-mode

# 5. 创建 Pull Request（在 GitHub 上）

# 6. 代码审查通过后，合并到主分支
git checkout main
git pull origin main
git merge --no-ff feature/dark-mode
git push origin main

# 7. 删除功能分支
git branch -d feature/dark-mode
git push origin --delete feature/dark-mode
```

### Bug 修复流程
```bash
# 1. 从主分支创建修复分支
git checkout main
git checkout -b hotfix/preview-crash

# 2. 修复 bug
# 编辑 src/ReactPlayground/components/Preview/index.tsx
git add src/ReactPlayground/components/Preview/index.tsx
git commit -m "fix: 修复 Preview 组件内存泄漏导致的崩溃"

# 3. 推送并合并
git push -u origin hotfix/preview-crash
# ... 创建 PR, 代码审查 ...
git checkout main
git merge hotfix/preview-crash
git push origin main

# 4. 打标签
git tag -a v1.0.1 -m "修复 Preview 崩溃问题"
git push origin v1.0.1
```

---

## 总结

掌握这些 Git 命令，你就能：
- ✅ 高效管理代码版本
- ✅ 协同团队开发
- ✅ 处理各种复杂场景
- ✅ 在面试中自信回答 Git 相关问题

**核心原则：**
1. 提交前先 `git diff` 检查改动
2. 提交信息要清晰规范
3. 公共分支不要 `force push`
4. 经常 `pull` 保持代码最新
5. 不确定时先 `stash` 保存工作

**持续学习：**
- 实践是最好的老师
- 遇到问题先 `git --help` 或 `git <command> --help`
- 参考 [Pro Git 电子书](https://git-scm.com/book/zh/v2)

---

**祝你面试成功！🎉**

