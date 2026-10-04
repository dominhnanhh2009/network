export const earlyWeb20Css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Verdana, Tahoma, "Segoe UI", Arial, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  background-color: #f0f2f5;
  color: #222;
}

a { color: #1a56a3; text-decoration: none; }
a:hover { text-decoration: underline; color: #0b3366; }

.container {
  max-width: 900px;
  margin: 15px auto;
  background: #ffffff;
  border: 1px solid #b8c1ca;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  overflow: hidden;
}

header {
  background: linear-gradient(180deg, #32537c 0%, #1f3755 100%);
  color: #fff;
  padding: 10px 16px;
  border-bottom: 2px solid #16273c;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

header h1 {
  font-size: 18px;
  font-weight: bold;
  letter-spacing: 0.5px;
}
header h1 a { color: #ffffff; }

.header-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}
.header-nav a { color: #d0e2ff; }
.header-nav a:hover { color: #ffffff; }

.badge {
  background: #ff5722;
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 10px;
}

.rep-badge {
  background: #2e7d32;
  color: #fff;
  font-size: 11px;
  font-family: monospace;
  padding: 2px 6px;
  border-radius: 3px;
}

.sub-header {
  background: #e4e9f0;
  border-bottom: 1px solid #ccd5e0;
  padding: 6px 16px;
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
}

.search-form {
  display: flex;
  gap: 5px;
}
.search-form input[type="text"] {
  padding: 3px 6px;
  font-size: 12px;
  border: 1px solid #99a8b8;
  border-radius: 2px;
}

.btn {
  background: linear-gradient(180deg, #f8f9fa 0%, #d8dde3 100%);
  border: 1px solid #8e9dae;
  border-radius: 3px;
  padding: 4px 10px;
  font-size: 12px;
  color: #1a2a3a;
  cursor: pointer;
  display: inline-block;
  font-family: inherit;
}
.btn:hover {
  background: linear-gradient(180deg, #ffffff 0%, #cbd2dc 100%);
  border-color: #607286;
}
.btn-primary {
  background: linear-gradient(180deg, #3d79b8 0%, #204c7b 100%);
  border-color: #17385c;
  color: #fff;
  font-weight: bold;
}
.btn-primary:hover {
  background: linear-gradient(180deg, #4d8ad0 0%, #173b61 100%);
  color: #fff;
}
.btn-small {
  padding: 2px 6px;
  font-size: 11px;
}

main { padding: 16px; }

.card {
  border: 1px solid #d0d7de;
  border-radius: 3px;
  background: #fafbfc;
  padding: 12px;
  margin-bottom: 14px;
}

.post-item {
  display: flex;
  gap: 12px;
  padding: 10px;
  border-bottom: 1px solid #e1e4e8;
}
.post-item:last-child { border-bottom: none; }

.vote-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  background: #f1f4f8;
  border: 1px solid #d4dde8;
  border-radius: 3px;
  padding: 4px 2px;
}

.vote-btn {
  background: transparent;
  border: none;
  font-size: 13px;
  cursor: pointer;
  color: #555;
  padding: 0 4px;
}
.vote-btn:hover { color: #000; font-weight: bold; }
.vote-score {
  font-size: 13px;
  font-weight: bold;
  font-family: monospace;
  margin: 2px 0;
}
.vote-breakdown {
  font-size: 9px;
  color: #777;
}

.post-body { flex: 1; }
.post-title {
  font-size: 15px;
  font-weight: bold;
  margin-bottom: 4px;
}
.post-meta {
  font-size: 11px;
  color: #666;
  margin-bottom: 6px;
}
.post-snippet {
  color: #333;
  margin-bottom: 8px;
  white-space: pre-wrap;
  word-break: break-word;
}
.post-media-thumb {
  max-width: 100%;
  max-height: 300px;
  border-radius: 3px;
  border: 1px solid #ccc;
  margin-top: 6px;
}

/* Comment Tree */
.comment-tree {
  margin-top: 20px;
}
.comment-node {
  margin-left: 16px;
  border-left: 2px solid #ccd6e0;
  padding-left: 10px;
  margin-top: 8px;
}
.comment-box {
  background: #fdfdfd;
  border: 1px solid #d9e0e8;
  border-radius: 3px;
  padding: 8px;
}
.comment-header {
  font-size: 11px;
  color: #666;
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}
.comment-content {
  font-size: 13px;
  color: #222;
  white-space: pre-wrap;
}

/* Forms */
.form-group {
  margin-bottom: 12px;
}
.form-group label {
  display: block;
  font-weight: bold;
  font-size: 12px;
  margin-bottom: 4px;
}
.form-group input[type="text"],
.form-group input[type="password"],
.form-group textarea {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #a8b6c5;
  border-radius: 3px;
  font-family: inherit;
  font-size: 13px;
}
.form-group textarea { min-height: 100px; resize: vertical; }

footer {
  background: #e8ecf1;
  border-top: 1px solid #c9d2dc;
  padding: 10px 16px;
  font-size: 11px;
  color: #555;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
`;
