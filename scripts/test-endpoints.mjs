/**
 * Comprehensive Automated Test Suite for Network Social Endpoints
 * Run with: node scripts/test-endpoints.mjs
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:8787';

console.log(`\n==================================================`);
console.log(`🚀 Starting Network Social Endpoint Test Suite`);
console.log(`🎯 Target URL: ${BASE_URL}`);
console.log(`==================================================\n`);

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} - ${details}`);
    failedTests++;
  }
}

async function run() {
  const ts = Date.now().toString(36);
  const user1 = `alice_${ts}`;
  const user2 = `bob_${ts}`;
  const user3 = `charlie_${ts}`;
  const pass = 'password123';

  let cookie1 = '';
  let cookie2 = '';
  let cookie3 = '';

  // 1. GET / (Home Page)
  console.log(`--- Test 1: Public Home Page ---`);
  try {
    const res = await fetch(`${BASE_URL}/`);
    assert(res.status === 200, 'Home page returns 200 OK');
    const html = await res.text();
    assert(html.includes('NETWORK'), 'Home page contains header branding');

    // Test Home in LLM Mode
    const resLlm = await fetch(`${BASE_URL}/?mode=llm`);
    const llmText = await resLlm.text();
    assert(resLlm.status === 200, 'Home page LLM mode returns 200 OK');
    assert(llmText.includes('# NETWORK SOCIAL (LLM-Optimized Interface)'), 'LLM mode returns clean markdown');
  } catch (err) {
    assert(false, 'Home page reachable', err.message);
  }

  // 2. POST /signup
  console.log(`\n--- Test 2: User Registration (/signup) ---`);
  try {
    // Register user1
    const res1 = await fetch(`${BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user1, password: pass }),
    });
    assert(res1.status === 201, `Sign up user ${user1} returns 201 Created`);
    const cookies1 = res1.headers.get('set-cookie') || '';
    assert(cookies1.includes(`u=${user1}`), 'Signup response sets auth cookie u=...');
    cookie1 = `u=${user1}&p=${pass}`;

    // Register user2
    const res2 = await fetch(`${BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user2, password: pass }),
    });
    assert(res2.status === 201, `Sign up user ${user2} returns 201 Created`);
    cookie2 = `u=${user2}&p=${pass}`;

    // Register user3
    const res3 = await fetch(`${BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user3, password: pass }),
    });
    assert(res3.status === 201, `Sign up user ${user3} returns 201 Created`);
    cookie3 = `u=${user3}&p=${pass}`;

    // Duplicate signup
    const resDup = await fetch(`${BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user1, password: pass }),
    });
    assert(resDup.status === 400, 'Duplicate signup rejected with 400 Bad Request');
  } catch (err) {
    assert(false, 'Signup operations', err.message);
  }

  // 3. GET /notifications (Login verification per spec)
  console.log(`\n--- Test 3: Auth Verification & Notifications (/notifications) ---`);
  try {
    // Unauthenticated request
    const unauth = await fetch(`${BASE_URL}/notifications?mode=json`);
    assert(unauth.status === 401, 'Unauthenticated /notifications returns 401 Unauthorized');

    // Authenticated request
    const authRes = await fetch(`${BASE_URL}/notifications?mode=json`, {
      headers: { Cookie: cookie1 },
    });
    assert(authRes.status === 200, 'Authenticated /notifications returns 200 OK');
    const authData = await authRes.json();
    assert(authData.logged_in === true && authData.username === user1, 'Confirms login status and username');
  } catch (err) {
    assert(false, 'Notifications auth check', err.message);
  }

  // 4. POST /posts (Create Post & Distribution)
  console.log(`\n--- Test 4: Post Creation & Custom Slug (/posts) ---`);
  let postId = '';
  try {
    const postRes = await fetch(`${BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie1,
      },
      body: JSON.stringify({
        title: 'Hello Edge Social',
        slug: 'first-announcement',
        content: 'This is the very first decentralized post on Cloudflare Workers.',
      }),
    });
    assert(postRes.status === 201, 'Post creation returns 201 Created');
    const postData = await postRes.json();
    postId = postData.post.id;
    assert(postId === `/${user1}/first-announcement`, `Post ID format matches spec: ${postId}`);
    assert(postData.post.views === 0, 'Initial views count is 0');
  } catch (err) {
    assert(false, 'Create post', err.message);
  }

  // 5. GET /:username/:slug (View Post & Public access)
  console.log(`\n--- Test 5: View Post & View Counter ---`);
  try {
    // First view (public, no auth)
    const view1 = await fetch(`${BASE_URL}${postId}?mode=json`);
    assert(view1.status === 200, 'Public post is viewable without login');
    const data1 = await view1.json();
    assert(data1.post.views === 1, 'View count incremented to 1');

    // Second view
    const view2 = await fetch(`${BASE_URL}${postId}?mode=json`);
    const data2 = await view2.json();
    assert(data2.post.views === 2, 'View count incremented to 2');

    // Check post LLM view
    const viewLlm = await fetch(`${BASE_URL}${postId}?mode=llm`);
    const llmBody = await viewLlm.text();
    assert(llmBody.includes(`Post: Hello Edge Social`), 'Post detail LLM mode formatted cleanly');
  } catch (err) {
    assert(false, 'View post', err.message);
  }

  // 6. Comments & Nested Tree (/comments)
  console.log(`\n--- Test 6: Comments Tree & Reply ---`);
  let comment1Id = '';
  let replyCommentId = '';
  try {
    // User2 adds top-level comment
    const c1Res = await fetch(`${BASE_URL}${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie2,
      },
      body: JSON.stringify({
        content: 'Great initiative! Welcome to the network.',
      }),
    });
    assert(c1Res.status === 201, 'User2 adds top-level comment (201 Created)');
    const c1Data = await c1Res.json();
    comment1Id = c1Data.comment.id;

    // User3 replies to User2's comment (nested)
    const replyRes = await fetch(`${BASE_URL}${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie3,
      },
      body: JSON.stringify({
        content: 'I agree with @' + user2 + '!',
        parent_id: comment1Id,
      }),
    });
    assert(replyRes.status === 201, 'User3 replies to comment (201 Created)');
    const replyData = await replyRes.json();
    replyCommentId = replyData.comment.id;

    // Fetch comments tree and verify hierarchy
    const postWithComments = await fetch(`${BASE_URL}${postId}?mode=json`);
    const treeData = await postWithComments.json();
    assert(treeData.comment_count === 2, 'Post reports total 2 comments');
    assert(treeData.comments.length === 1, 'Root tree has 1 top-level node');
    assert(treeData.comments[0].replies.length === 1, 'Top-level comment contains 1 nested reply node');
    assert(treeData.comments[0].replies[0].id === replyCommentId, 'Nested reply ID matches');
  } catch (err) {
    assert(false, 'Comments tree', err.message);
  }

  // 7. Voting & Gained Votes Calculation (/vote)
  console.log(`\n--- Test 7: Voting & Gained Votes (Reputation) ---`);
  try {
    // User2 upvotes Alice's post
    const v1Res = await fetch(`${BASE_URL}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie2,
      },
      body: JSON.stringify({
        target_type: 'post',
        target_id: postId,
        vote_type: 1,
      }),
    });
    assert(v1Res.status === 200, 'Upvote post returns 200 OK');
    const v1Data = await v1Res.json();
    assert(v1Data.upvotes === 1 && v1Data.sum === 1, 'Post vote count: 1 upvote, sum = 1');

    // Check Alice's gained votes on profile
    const profileRes = await fetch(`${BASE_URL}/user/${user1}?mode=json`);
    const profileData = await profileRes.json();
    assert(profileData.gained_votes === 1, `Alice's Gained Votes updated to 1 (+1 from post)`);

    // User1 upvotes User2's comment
    const v2Res = await fetch(`${BASE_URL}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie1,
      },
      body: JSON.stringify({
        target_type: 'comment',
        target_id: comment1Id,
        vote_type: 1,
      }),
    });
    assert(v2Res.status === 200, 'Upvote comment returns 200 OK');

    // Check Bob's gained votes
    const bobProfile = await fetch(`${BASE_URL}/user/${user2}?mode=json`);
    const bobData = await bobProfile.json();
    assert(bobData.gained_votes === 1, `Bob's Gained Votes updated to 1 (+1 from comment)`);
  } catch (err) {
    assert(false, 'Voting mechanisms', err.message);
  }

  // 8. Notification Deduplication & Mechanics
  console.log(`\n--- Test 8: Notification Distribution & Deduplication ---`);
  try {
    const notifRes2 = await fetch(`${BASE_URL}/notifications?mode=json`, {
      headers: { Cookie: cookie2 },
    });
    const notifData2 = await notifRes2.json();
    const hasPostNotif = notifData2.notifications.some((n) => n.post_id === postId);
    assert(hasPostNotif, 'Bob received distributed notification for new post');

    // Verify deduplication: count notifications with this post_id for Bob
    const count = notifData2.notifications.filter((n) => n.post_id === postId).length;
    assert(count === 1, 'Notifications are strictly deduplicated (no repeated post_id)');
  } catch (err) {
    assert(false, 'Notification distribution check', err.message);
  }

  // 9. Search (/search)
  console.log(`\n--- Test 9: Search Engine & Filters ---`);
  try {
    // Keyword search
    const s1 = await fetch(`${BASE_URL}/search?q=Edge&mode=json`);
    const s1Data = await s1.json();
    assert(s1Data.results.posts.length >= 1, 'Search finds post by keyword');

    // Search with user filter
    const s2 = await fetch(`${BASE_URL}/search?q=Edge&user=${user1}&mode=json`);
    const s2Data = await s2.json();
    assert(s2Data.results.posts.length >= 1, 'Search with user filter matches author');

    // Search comment keyword
    const s3 = await fetch(`${BASE_URL}/search?q=initiative&mode=json`);
    const s3Data = await s3.json();
    assert(s3Data.results.comments.length >= 1, 'Search finds comment by text');
  } catch (err) {
    assert(false, 'Search functionality', err.message);
  }

  // 10. Native Media Upload & Serving (/upload & /media/:id)
  console.log(`\n--- Test 10: Native Multi-media Storage ---`);
  try {
    const sampleText = 'PNG_MOCK_DATA_EDGE_NETWORK_BINARY';
    const uploadRes = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        Cookie: cookie1,
      },
      body: sampleText,
    });
    assert(uploadRes.status === 201, 'Binary media upload returns 201 Created');
    const uploadData = await uploadRes.json();
    assert(uploadData.url && uploadData.url.startsWith('/media/'), 'Returns media URL /media/:id');

    // Fetch uploaded media back
    const mediaFetch = await fetch(`${BASE_URL}${uploadData.url}`);
    assert(mediaFetch.status === 200, 'Serve media returns 200 OK');
    const fetchedText = await mediaFetch.text();
    assert(fetchedText === sampleText, 'Retrieved media content matches uploaded data');
    assert(mediaFetch.headers.get('cache-control')?.includes('immutable'), 'Serves with immutable edge cache headers');
  } catch (err) {
    assert(false, 'Media upload and retrieval', err.message);
  }

  // 11. Fullmap & Pagination Verification (/fullmap & /llms.txt)
  console.log(`\n--- Test 11: LLM Fullmap & Pagination ---`);
  try {
    const fullmapRes = await fetch(`${BASE_URL}/fullmap`);
    assert(fullmapRes.status === 200, 'GET /fullmap returns 200 OK');
    const fullmapText = await fullmapRes.text();
    assert(fullmapText.includes('# NETWORK SOCIAL - FULL SITE MAP'), 'Fullmap contains agent integration manual');

    const llmsRes = await fetch(`${BASE_URL}/llms.txt`);
    assert(llmsRes.status === 200, 'GET /llms.txt returns 200 OK');

    // Test Home pagination in JSON mode
    const pageRes = await fetch(`${BASE_URL}/?page=1&limit=2`, {
      headers: { 'Accept': 'application/json' },
    });
    assert(pageRes.status === 200, 'Home page with pagination returns 200 OK');
    const pageData = await pageRes.json();
    assert(pageData.page === 1 && pageData.limit === 2, 'Home page JSON reflects page & limit parameters');
    assert(Array.isArray(pageData.posts), 'Returns posts array with pagination');
  } catch (err) {
    assert(false, 'Fullmap and pagination verification', err.message);
  }

  // Summary
  console.log(`\n==================================================`);
  console.log(`🏁 Test Results: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log(`==================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
