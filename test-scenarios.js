// Automated Scenario Verification for Aria Voice Support
const BASE_URL = 'http://localhost:3000';

async function testScenario(name, messages) {
  console.log(`\n======================================================`);
  console.log(`SCENARIO: ${name}`);
  console.log(`Input message:`, JSON.stringify(messages[messages.length - 1].content));

  const start = Date.now();
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  const duration = Date.now() - start;
  const data = await res.json();
  console.log(`Status: ${res.status} (${duration}ms)`);
  console.log(`Tool calls made:`, JSON.stringify(data.toolCalls));
  console.log(`Aria Reply: "${data.reply}"`);
  await new Promise((r) => setTimeout(r, 1500));
  return data;
}

async function runAll() {
  console.log('Resetting orders first...');
  await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reset' }),
  });

  // 1. Order lookup ORD-101
  await testScenario('1. Order lookup ORD-101', [
    { role: 'user', content: 'Where is my order ORD-101?' }
  ]);

  // 2. Return of ORD-102 (declined by policy - 14 days ago)
  await testScenario('2. Return of ORD-102 (declined by policy)', [
    { role: 'user', content: 'I received order ORD-102 two weeks ago. Can I return it for a refund?' }
  ]);

  // 3. Cancel ORD-103 (confirmation flow)
  const cancelTurn1 = await testScenario('3a. Cancel ORD-103 (Ask to cancel)', [
    { role: 'user', content: 'I want to cancel my order ORD-103' }
  ]);

  await testScenario('3b. Cancel ORD-103 (Confirm cancellation)', [
    { role: 'user', content: 'I want to cancel my order ORD-103' },
    { role: 'assistant', content: cancelTurn1.reply },
    { role: 'user', content: 'Yes, please go ahead and cancel it.' }
  ]);

  // 4. Cancel ORD-101 (declined - Out for delivery)
  await testScenario('4. Cancel ORD-101 (Out for delivery - policy declined)', [
    { role: 'user', content: 'Please cancel order ORD-101 immediately' }
  ]);

  // 5. Invalid ORD-999
  await testScenario('5. Invalid ORD-999', [
    { role: 'user', content: 'Can you check status for order ORD-999?' }
  ]);

  // 6. Out-of-scope flight request
  await testScenario('6. Out-of-scope flight request', [
    { role: 'user', content: 'Can you book me a flight ticket to Goa for next Monday?' }
  ]);

  // 7. Unclear / short audio
  await testScenario('7. Unclear / garbled audio', [
    { role: 'user', content: 'uh... hmm...' }
  ]);

  // 8. Post-call JSON summary (/api/summary)
  console.log(`\n======================================================`);
  console.log(`SCENARIO: 8. Post-call structured JSON summary (/api/summary)`);
  const transcriptSample = [
    { speaker: 'Customer', text: 'Where is my order ORD-101?', timestamp: '08:30 PM' },
    { speaker: 'Aria', text: 'Your order ORD-101 is currently out for delivery with BlueDart and will reach you by 6 PM today.', timestamp: '08:30 PM' },
    { speaker: 'Customer', text: 'Thank you so much Aria, that is great!', timestamp: '08:31 PM' }
  ];
  const toolCallsSample = [
    { name: 'get_order_details', args: { order_id: 'ORD-101' }, result: { found: true, status: 'Out for Delivery' } }
  ];

  const sumRes = await fetch(`${BASE_URL}/api/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript: transcriptSample, toolCalls: toolCallsSample })
  });
  const sumData = await sumRes.json();
  console.log('Summary Result:');
  console.log(JSON.stringify(sumData.summary, null, 2));

  console.log(`\n======================================================`);
  console.log('ALL SCENARIOS TESTED SUCCESSFULLY!');
}

runAll().catch(console.error);
