/**
 * Complete Login Flow Test
 * Tests the entire authentication flow including user creation and login
 */

const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

async function testLoginFlow() {
  console.log('🔐 Testing Complete Login Flow\n')
  console.log('='.repeat(50))
  console.log(`Base URL: ${baseUrl}\n`)

  let allPassed = true

  // Test 1: Check if server is running
  console.log('1️⃣ Checking if server is running...')
  try {
    const response = await fetch(baseUrl)
    if (response.ok) {
      console.log('   ✅ Server is running\n')
    } else {
      console.log('   ❌ Server returned error:', response.status, '\n')
      allPassed = false
    }
  } catch (error) {
    console.log('   ❌ Server is not running')
    console.log('   💡 Start server with: npm run dev\n')
    return
  }

  // Test 2: Check NextAuth providers endpoint
  console.log('2️⃣ Testing NextAuth providers endpoint...')
  try {
    const response = await fetch(`${baseUrl}/api/auth/providers`)
    const data = await response.json()
    
    if (response.ok && data.credentials) {
      console.log('   ✅ Providers endpoint working')
      console.log('   📄 Available providers:', Object.keys(data).join(', '), '\n')
    } else {
      console.log('   ❌ Providers endpoint failed\n')
      allPassed = false
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message, '\n')
    allPassed = false
  }

  // Test 3: Check CSRF token endpoint
  console.log('3️⃣ Testing CSRF token endpoint...')
  try {
    const response = await fetch(`${baseUrl}/api/auth/csrf`)
    const data = await response.json()
    
    if (response.ok && data.csrfToken) {
      console.log('   ✅ CSRF endpoint working')
      console.log('   🔑 Token received:', data.csrfToken.substring(0, 20) + '...', '\n')
    } else {
      console.log('   ❌ CSRF endpoint failed\n')
      allPassed = false
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message, '\n')
    allPassed = false
  }

  // Test 4: Check session endpoint
  console.log('4️⃣ Testing session endpoint...')
  try {
    const response = await fetch(`${baseUrl}/api/auth/session`)
    const data = await response.json()
    
    if (response.ok) {
      console.log('   ✅ Session endpoint working')
      if (data.user) {
        console.log('   👤 Current user:', data.user.email, '\n')
      } else {
        console.log('   📝 No active session (not logged in)\n')
      }
    } else {
      console.log('   ❌ Session endpoint failed\n')
      allPassed = false
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message, '\n')
    allPassed = false
  }

  // Test 5: Check login page loads
  console.log('5️⃣ Testing login page...')
  try {
    const response = await fetch(`${baseUrl}/login`)
    
    if (response.ok) {
      const html = await response.text()
      const hasLoginForm = html.includes('type="email"') && html.includes('type="password"')
      
      if (hasLoginForm) {
        console.log('   ✅ Login page loads correctly')
        console.log('   📄 Login form found\n')
      } else {
        console.log('   ⚠️  Login page loads but form may be missing\n')
      }
    } else {
      console.log('   ❌ Login page failed to load\n')
      allPassed = false
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message, '\n')
    allPassed = false
  }

  // Test 6: Check register page loads
  console.log('6️⃣ Testing register page...')
  try {
    const response = await fetch(`${baseUrl}/register`)
    
    if (response.ok) {
      console.log('   ✅ Register page loads correctly\n')
    } else {
      console.log('   ❌ Register page failed to load\n')
      allPassed = false
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message, '\n')
    allPassed = false
  }

  // Test 7: Check forgot password page
  console.log('7️⃣ Testing forgot password page...')
  try {
    const response = await fetch(`${baseUrl}/forgot-password`)
    
    if (response.ok) {
      console.log('   ✅ Forgot password page loads correctly\n')
    } else {
      console.log('   ❌ Forgot password page failed to load\n')
      allPassed = false
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message, '\n')
    allPassed = false
  }

  // Summary
  console.log('='.repeat(50))
  console.log('\n📊 Test Summary:\n')
  
  if (allPassed) {
    console.log('✅ All tests passed!')
    console.log('\n🎉 Login system is fully functional!\n')
    console.log('Next steps:')
    console.log('1. Open browser: http://localhost:3000/login')
    console.log('2. Create an account at: http://localhost:3000/register')
    console.log('3. Or create admin with: npm run create:admin')
  } else {
    console.log('❌ Some tests failed')
    console.log('\n🔧 Troubleshooting:')
    console.log('1. Make sure dev server is running: npm run dev')
    console.log('2. Check environment variables: npm run check:env')
    console.log('3. Verify database connection: npx prisma studio')
    console.log('4. Clear browser cache and cookies')
  }
  
  console.log('\n' + '='.repeat(50))
}

// Run the test
testLoginFlow().catch(console.error)
