// Performance comparison: Before vs After optimizations
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/analyze-ticket';

// Standardized test payload for fair comparison
const comparisonPayload = {
  "qaProfile": {
    "qaCategories": {
      "functional": true,
      "ui": true,
      "negative": true,
      "api": false,
      "database": false,
      "performance": false,
      "security": false,
      "mobile": false,
      "accessibility": false
    },
    "testCaseFormat": "gherkin",
    "autoRefresh": true,
    "includeComments": true,
    "includeImages": true, // Include images to test full pipeline
    "operationMode": "online",
    "showNotifications": true
  },
  "ticketJson": {
    "issueKey": "PERF-COMP-001",
    "summary": "Performance comparison test for QA document generation optimizations",
    "description": "This ticket is used to test and compare the performance improvements made to the QA document generation system. The optimizations include: 1) Parallel image processing instead of sequential, 2) Section-based document generation with optimized prompts, 3) Detailed timing measurements for bottleneck identification. Expected improvements: 50-70% faster generation times while maintaining or improving document quality.",
    "issueType": "Task",
    "priority": "High",
    "status": "In Progress",
    "assignee": "Performance Team",
    "reporter": "QA Lead",
    "components": ["Performance", "QA Automation"],
    "customFields": {
      "acceptanceCriteria": "System should generate QA documents significantly faster with maintained quality",
      "performanceTarget": "Under 15 seconds total generation time",
      "qualityTarget": "Maintain current document completeness and accuracy"
    },
    "attachments": [
      {
        "name": "performance-test-1.png",
        "mime": "image/png",
        "size": 45000,
        "tooBig": false,
        "data": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
      },
      {
        "name": "performance-test-2.jpg",
        "mime": "image/jpeg",
        "size": 52000,
        "tooBig": false,
        "data": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
      }
    ],
    "comments": [
      {
        "author": "Performance Engineer",
        "date": "2025-01-20",
        "body": "Implementing parallel processing for both image handling and document section generation. This should significantly reduce total processing time."
      },
      {
        "author": "QA Architect",
        "date": "2025-01-20", 
        "body": "The new section-based approach allows us to optimize prompts for each specific section, reducing token usage while improving quality and specificity."
      },
      {
        "author": "Tech Lead",
        "date": "2025-01-20",
        "body": "Key metrics to track: total generation time, individual section times, image processing time, token usage, and document quality scores."
      }
    ]
  }
};

async function runPerformanceComparison() {
  console.log('🏁 Performance Comparison: Before vs After Optimizations');
  console.log('📊 Testing comprehensive performance improvements:');
  console.log('   ⚡ Parallel image processing');
  console.log('   🧠 Section-based document generation');
  console.log('   📝 Optimized prompts per section');
  console.log('   ⏱️  Detailed timing measurements');
  
  console.log('\n🎯 Performance Targets:');
  console.log('   - Total time: < 15 seconds (down from 25-30s)');
  console.log('   - Image processing: < 3 seconds (parallel)');
  console.log('   - Document generation: < 10 seconds (section-based)');
  console.log('   - Quality: Maintain or improve current standards');
  
  const runs = 3; // Multiple runs for average
  const results = [];
  
  for (let run = 1; run <= runs; run++) {
    console.log(`\n🔄 Run ${run}/${runs}:`);
    const runStartTime = Date.now();
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(comparisonPayload),
      });

      const runEndTime = Date.now();
      const totalTime = runEndTime - runStartTime;

      if (response.ok) {
        const data = await response.json();
        
        const result = {
          run,
          totalTime,
          serverGenerationTime: data.metadata?.generationTime || null,
          success: true,
          sections: {
            ticketSummary: !!data.ticketSummary,
            acceptanceCriteria: data.acceptanceCriteria?.length || 0,
            testCases: data.testCases?.length || 0,
            configurationWarnings: data.configurationWarnings?.length || 0
          },
          quality: {
            wordCount: data.metadata?.wordCount || 0,
            allSectionsPresent: !!(data.ticketSummary && data.acceptanceCriteria && data.testCases)
          }
        };
        
        results.push(result);
        
        console.log(`   ✅ Success: ${totalTime}ms total, ${result.serverGenerationTime}ms server`);
        console.log(`   📊 Sections: ${result.sections.acceptanceCriteria} criteria, ${result.sections.testCases} test cases`);
        
      } else {
        const errorData = await response.json();
        results.push({
          run,
          totalTime,
          success: false,
          error: errorData.error
        });
        console.log(`   ❌ Failed: ${errorData.error} (${totalTime}ms)`);
      }
      
      // Wait between runs to avoid rate limiting
      if (run < runs) {
        console.log('   ⏳ Waiting 2 seconds before next run...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      const runEndTime = Date.now();
      const totalTime = runEndTime - runStartTime;
      
      results.push({
        run,
        totalTime,
        success: false,
        error: error.message
      });
      console.log(`   ❌ Network error: ${error.message} (${totalTime}ms)`);
    }
  }
  
  // Calculate statistics
  const successfulRuns = results.filter(r => r.success);
  
  if (successfulRuns.length > 0) {
    const avgTotalTime = successfulRuns.reduce((sum, r) => sum + r.totalTime, 0) / successfulRuns.length;
    const avgServerTime = successfulRuns.reduce((sum, r) => sum + (r.serverGenerationTime || 0), 0) / successfulRuns.length;
    const minTime = Math.min(...successfulRuns.map(r => r.totalTime));
    const maxTime = Math.max(...successfulRuns.map(r => r.totalTime));
    
    console.log('\n📈 Performance Results Summary:');
    console.log(`   🎯 Success Rate: ${successfulRuns.length}/${runs} (${(successfulRuns.length/runs*100).toFixed(1)}%)`);
    console.log(`   ⏱️  Average Total Time: ${avgTotalTime.toFixed(0)}ms`);
    console.log(`   🖥️  Average Server Time: ${avgServerTime.toFixed(0)}ms`);
    console.log(`   📊 Time Range: ${minTime}ms - ${maxTime}ms`);
    
    // Performance evaluation
    console.log('\n🎯 Performance Evaluation:');
    if (avgTotalTime < 15000) {
      console.log('   🏆 OUTSTANDING: Target achieved! Under 15 seconds average');
    } else if (avgTotalTime < 20000) {
      console.log('   🚀 EXCELLENT: Under 20 seconds - significant improvement');
    } else if (avgTotalTime < 25000) {
      console.log('   ✅ GOOD: Under 25 seconds - noticeable improvement');
    } else {
      console.log('   ⚠️  NEEDS WORK: Still over 25 seconds - more optimization needed');
    }
    
    // Quality evaluation
    const avgCriteria = successfulRuns.reduce((sum, r) => sum + r.sections.acceptanceCriteria, 0) / successfulRuns.length;
    const avgTestCases = successfulRuns.reduce((sum, r) => sum + r.sections.testCases, 0) / successfulRuns.length;
    const allSectionsRate = successfulRuns.filter(r => r.quality.allSectionsPresent).length / successfulRuns.length;
    
    console.log('\n📋 Quality Evaluation:');
    console.log(`   📝 Average Acceptance Criteria: ${avgCriteria.toFixed(1)} (target: 3-5)`);
    console.log(`   🧪 Average Test Cases: ${avgTestCases.toFixed(1)} (target: 3-5)`);
    console.log(`   ✅ Complete Documents: ${(allSectionsRate * 100).toFixed(1)}% (target: 100%)`);
    
    // Historical comparison (estimated)
    console.log('\n📊 Estimated Improvement vs Previous System:');
    const estimatedOldTime = 28000; // Estimated old average
    const improvement = ((estimatedOldTime - avgTotalTime) / estimatedOldTime * 100);
    console.log(`   📉 Time Reduction: ~${improvement.toFixed(1)}% faster`);
    console.log(`   ⏱️  Before: ~${estimatedOldTime/1000}s → After: ~${(avgTotalTime/1000).toFixed(1)}s`);
    
    if (improvement >= 50) {
      console.log('   🎉 MAJOR IMPROVEMENT: 50%+ faster generation!');
    } else if (improvement >= 30) {
      console.log('   🚀 SIGNIFICANT IMPROVEMENT: 30%+ faster generation');
    } else if (improvement >= 15) {
      console.log('   ✅ GOOD IMPROVEMENT: 15%+ faster generation');
    } else {
      console.log('   ⚠️  MINOR IMPROVEMENT: Less than 15% improvement');
    }
    
  } else {
    console.log('\n❌ No successful runs - unable to calculate performance metrics');
  }
  
  console.log('\n🏁 Performance comparison completed!');
}

runPerformanceComparison();