import re

with open('src/pages/LandingPage.tsx', 'r') as f:
    content = f.read()

# 1. Imports
content = content.replace("import GitHubIcon from '@mui/icons-material/GitHub';", "import GitHubIcon from '@mui/icons-material/GitHub';\nimport ChatIcon from '@mui/icons-material/Chat';\nimport HistoryIcon from '@mui/icons-material/History';")

# 2. Header Links
old_links = """            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 4 }}>
              {['Features', 'How it works', 'Testimonials', 'Pricing'].map((item) => (
                <Typography
                  key={item}
                  sx={{
                    fontSize: '0.9rem',
                    color: '#a0a0cc',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'color 0.2s',
                    '&:hover': { color: '#ffffff' },
                  }}
                >
                  {item}
                </Typography>
              ))}
            </Box>"""
new_links = """            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 4 }}>
              {[
                { label: 'Features', id: 'features' },
                { label: 'How it works', id: 'how-it-works' },
                { label: 'Pricing', id: 'pricing' }
              ].map((item) => (
                <Typography
                  key={item.id}
                  onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })}
                  sx={{
                    fontSize: '0.9rem',
                    color: '#a0a0cc',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'color 0.2s',
                    '&:hover': { color: '#ffffff' },
                  }}
                >
                  {item.label}
                </Typography>
              ))}
            </Box>"""
content = content.replace(old_links, new_links)

# 3. Features array
old_features_array = """            {[
              {
                icon: <AutoAwesomeIcon sx={{ color: '#6c63ff' }} />,
                title: 'Repository Intelligence',
                desc: 'Let our AI scan the entire codebase to understand dependencies, patterns, and architecture.',
              },
              {
                icon: <CodeIcon sx={{ color: '#6c63ff' }} />,
                title: 'Dependency Discovery',
                desc: 'See exactly how different files and modules rely on one another before making a change.',
              },
              {
                icon: <AccountTreeIcon sx={{ color: '#6c63ff' }} />,
                title: 'Architecture Intelligence',
                desc: 'Visual representations of your codebase to quickly grasp the overarching structure.',
              },
              {
                icon: <InsightsIcon sx={{ color: '#6c63ff' }} />,
                title: 'Impact Analysis',
                desc: 'Understand what will break if you modify a certain file or update a specific module.',
              },
              {
                icon: <SecurityIcon sx={{ color: '#6c63ff' }} />,
                title: 'Semantic Code Search',
                desc: 'Search for what code does, not just exact keyword matches. Find logic naturally.',
              },
              {
                icon: <GitHubIcon sx={{ color: '#6c63ff' }} />,
                title: 'Technical Debt',
                desc: 'Automatically identify complex files, large files, and tightly coupled modules.',
              },
            ]"""
new_features_array = """            {[
              {
                icon: <ChatIcon sx={{ color: '#6c63ff' }} />,
                title: 'Repository Intelligence',
                desc: 'Chat naturally with an entire GitHub repository. Understand authentication, APIs, business logic, dependencies, and workflows instantly.',
                tag: undefined
              },
              {
                icon: <HistoryIcon sx={{ color: '#6c63ff' }} />,
                title: 'Repository Memory',
                desc: 'Understand why decisions were made by analyzing commits, pull requests, issues, and documentation.',
                tag: '⭐ Flagship Feature'
              },
              {
                icon: <AccountTreeIcon sx={{ color: '#6c63ff' }} />,
                title: 'Impact Analysis',
                desc: 'Before changing code, instantly understand what APIs, services, and modules may be affected.',
                tag: undefined
              },
              {
                icon: <InsightsIcon sx={{ color: '#6c63ff' }} />,
                title: 'Repository Health Dashboard',
                desc: 'Monitor code quality, documentation, maintainability, technical debt, dependency health, and overall repository health.',
                tag: undefined
              },
              {
                icon: <AutoAwesomeIcon sx={{ color: '#6c63ff' }} />,
                title: 'Productivity Intelligence',
                desc: 'Automatically generate release notes, changelogs, sprint summaries, documentation, and feature summaries from repository history.',
                tag: undefined
              },
            ]"""
content = content.replace(old_features_array, new_features_array)

# 4. Features Section missing id
content = content.replace("        {/* Features Section */}\n        <Box sx={{ mt: 10, mb: 20 }}>", "        {/* Features Section */}\n        <Box id=\"features\" sx={{ mt: 10, mb: 20 }}>")

# 5. Features Card update to support tag
old_card = """                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{"""
new_card = """                  <CardContent sx={{ p: 3 }}>
                    {f.tag && (
                      <Box sx={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255, 215, 0, 0.1)', color: '#ffd700', px: 1.5, py: 0.5, borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                        {f.tag}
                      </Box>
                    )}
                    <Box
                      sx={{"""
content = content.replace(old_card, new_card)

# also add relative position to features card
content = content.replace("borderRadius: '16px',\n                    transition: 'all 0.3s ease',\n                    '&:hover': {", "borderRadius: '16px',\n                    transition: 'all 0.3s ease',\n                    position: 'relative',\n                    '&:hover': {")

# 6. Workflow Section and Testimonials
new_workflow = """        {/* Workflow Section */}
        <Box id="how-it-works" sx={{ mb: 20 }}>
          <Typography
            variant="h3"
            sx={{
              textAlign: 'center',
              fontWeight: 800,
              color: '#ffffff',
              mb: 2,
              fontSize: { xs: '2rem', sm: '2.5rem' },
            }}
          >
            How RepoMind Works
          </Typography>
          <Typography
            sx={{
              textAlign: 'center',
              color: '#8888aa',
              mb: 8,
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            From your code repository to actionable insights in a seamless pipeline.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', justifyContent: 'center', gap: 2, mb: 12 }}>
            {['Connect GitHub Repository', 'Repository Parser', 'Knowledge Base', 'AI Intelligence', 'Developer Insights'].map((step, index) => (
              <React.Fragment key={step}>
                <Card
                  sx={{
                    background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                    border: '1px solid rgba(108, 99, 255, 0.3)',
                    borderRadius: '12px',
                    p: 2,
                    textAlign: 'center',
                    minWidth: '150px',
                    transition: 'transform 0.3s',
                    '&:hover': { transform: 'scale(1.05)' }
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{step}</Typography>
                </Card>
                {index < 4 && (
                  <Box sx={{ color: '#6c63ff', display: { xs: 'none', md: 'block' } }}>→</Box>
                )}
                {index < 4 && (
                  <Box sx={{ color: '#6c63ff', display: { xs: 'block', md: 'none' } }}>↓</Box>
                )}
              </React.Fragment>
            ))}
          </Box>

          {/* Demos */}
          <Grid container spacing={6}>
            {/* AI Chat Demo */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ background: '#12121a', border: '1px solid #2a2a35', borderRadius: '16px', height: '100%' }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography sx={{ color: '#fff', fontWeight: 700, mb: 3 }}>AI Chat Demo</Typography>
                  <Box sx={{ background: '#1e1e2d', p: 2, borderRadius: '8px', mb: 2 }}>
                    <Typography sx={{ color: '#8888aa', fontSize: '0.85rem', mb: 1 }}>User:</Typography>
                    <Typography sx={{ color: '#fff' }}>"Explain how authentication works."</Typography>
                  </Box>
                  <Box sx={{ background: 'rgba(108, 99, 255, 0.1)', p: 2, borderRadius: '8px', borderLeft: '4px solid #6c63ff' }}>
                    <Typography sx={{ color: '#8888aa', fontSize: '0.85rem', mb: 1 }}>RepoMind:</Typography>
                    <Typography sx={{ color: '#e0e0ff', fontSize: '0.9rem', mb: 2 }}>
                      Authentication starts in <code>AuthController</code>.<br />
                      JWT tokens are generated in <code>TokenService</code>.<br />
                      Login requests pass through <code>AuthMiddleware</code>.<br />
                      User data is stored in PostgreSQL.
                    </Typography>
                    <Typography sx={{ color: '#8888aa', fontSize: '0.8rem', mb: 1 }}>Related files:</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {['AuthController.ts', 'TokenService.ts', 'UserService.ts'].map(f => (
                        <Box key={f} sx={{ background: '#2a2a35', px: 1, py: 0.5, borderRadius: '4px', fontSize: '0.75rem', color: '#00c896' }}>{f}</Box>
                      ))}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Repository Memory Demo */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ background: '#12121a', border: '1px solid #2a2a35', borderRadius: '16px', height: '100%' }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography sx={{ color: '#fff', fontWeight: 700, mb: 3 }}>Repository Memory Demo</Typography>
                  <Box sx={{ background: '#1e1e2d', p: 2, borderRadius: '8px', mb: 2 }}>
                    <Typography sx={{ color: '#8888aa', fontSize: '0.85rem', mb: 1 }}>Question:</Typography>
                    <Typography sx={{ color: '#fff' }}>"Why was Redis introduced?"</Typography>
                  </Box>
                  <Box sx={{ borderLeft: '2px solid #333', ml: 2, pl: 2, py: 1 }}>
                    <Box sx={{ position: 'relative' }}>
                      <Box sx={{ position: 'absolute', left: -21, top: 4, width: 10, height: 10, borderRadius: '50%', background: '#6c63ff' }} />
                      <Typography sx={{ color: '#e0e0ff', fontSize: '0.9rem', mb: 1 }}>
                        Redis was added in <strong>PR #152</strong> by <strong>John Smith</strong> to reduce authentication latency and improve session performance.
                      </Typography>
                      <Typography sx={{ color: '#8888aa', fontSize: '0.8rem' }}>
                        It is now used by Authentication, Notifications, and Rate Limiting.
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Impact Analysis Demo */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ background: '#12121a', border: '1px solid #2a2a35', borderRadius: '16px', height: '100%' }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography sx={{ color: '#fff', fontWeight: 700, mb: 3 }}>Impact Analysis Demo</Typography>
                  <Typography sx={{ color: '#8888aa', fontSize: '0.85rem', mb: 1 }}>Selected File:</Typography>
                  <Box sx={{ background: '#2a2a35', display: 'inline-block', px: 2, py: 1, borderRadius: '8px', color: '#fff', mb: 3 }}>
                    AuthService.ts
                  </Box>
                  <Typography sx={{ color: '#8888aa', fontSize: '0.85rem', mb: 1 }}>Affected Components (Risk Level: <strong style={{ color: '#ff4444' }}>High</strong>):</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {['Login API', 'Dashboard', 'Payments', 'Notifications', 'Orders'].map(c => (
                      <Box key={c} sx={{ background: 'rgba(255, 68, 68, 0.1)', border: '1px solid rgba(255, 68, 68, 0.3)', color: '#ff4444', px: 1.5, py: 0.5, borderRadius: '4px', fontSize: '0.8rem' }}>
                        {c}
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Health Dashboard & Productivity */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, height: '100%' }}>
                <Card sx={{ background: '#12121a', border: '1px solid #2a2a35', borderRadius: '16px' }}>
                  <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>Overall Health</Typography>
                      <Typography sx={{ color: '#8888aa', fontSize: '0.8rem' }}>Code Quality, Docs, Debt</Typography>
                    </Box>
                    <Typography sx={{ color: '#00c896', fontSize: '2.5rem', fontWeight: 900 }}>92%</Typography>
                  </CardContent>
                </Card>
                
                <Card sx={{ background: '#12121a', border: '1px solid #2a2a35', borderRadius: '16px', flex: 1 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>Productivity Outputs</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {['Release Notes', 'Changelog', 'Sprint Summary', 'Documentation'].map(doc => (
                        <Box key={doc} sx={{ background: 'rgba(0, 200, 150, 0.1)', border: '1px solid rgba(0, 200, 150, 0.3)', color: '#00c896', px: 1.5, py: 0.5, borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AutoAwesomeIcon sx={{ fontSize: 14 }} /> {doc}
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Grid>
          </Grid>
        </Box>\n\n"""

# Remove workflow and testimonials and replace
content = re.sub(r'        \{/\* Workflow Section \*/\}.*?(?=        \{/\* CTA Banner \*/\})', new_workflow, content, flags=re.DOTALL)

# Add id to CTA Banner
content = content.replace("        {/* CTA Banner */}\n        <Box", "        {/* CTA Banner */}\n        <Box\n          id=\"pricing\"")

with open('src/pages/LandingPage.tsx', 'w') as f:
    f.write(content)
