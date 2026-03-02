# Deployment Guide: drivebook-hybrid

This guide covers deploying the AI voice receptionist microservice to production on AWS, Heroku, or similar cloud platforms.

## Pre-Deployment Checklist

Before deploying, ensure:

- ✅ Local tests pass: `npm test`
- ✅ Smoke tests pass: `npm test -- smoke.test.js`
- ✅ All environment variables documented (see [Configuration](#configuration))
- ✅ Twilio account set up with webhook URL
- ✅ Copilot Studio agents created and configured
- ✅ DriveBook API key obtained
- ✅ Stripe Secret Key obtained

## Configuration

### Required Environment Variables

Create a strict set of **required** variables (production must have all):

```bash
# DriveBook Integration
DRIVEBOOK_BASE_URL=https://api.drivebook.com.au      # Your main API endpoint
DRIVEBOOK_API_KEY=sk_live_xxxxxxxxxxxxx               # Secret API key from DriveBook

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+61400000000                      # Your Twilio number in E.164 format

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxx

# Copilot Studio
COPILOT_BASE_URL=https://copilotstudio.microsoft.com/copilot/xxxxx

# Server
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

### Optional Variables

```bash
# Useful for monitoring and debugging
DEBUG_MODE=false
LOG_FORMAT=json                     # json or text
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
```

## Deployment Strategies

### Option 1: AWS ECS (Recommended for Scale)

#### 1. Build and Push Docker Image

```bash
# Login to AWS ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

# Build and tag
docker build -t drivebook-hybrid:latest .
docker tag drivebook-hybrid:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/drivebook-hybrid:latest
docker tag drivebook-hybrid:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/drivebook-hybrid:v1.0.0

# Push
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/drivebook-hybrid:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/drivebook-hybrid:v1.0.0
```

#### 2. Create ECS Task Definition

In AWS Console → ECS → Task Definitions → Create new:

```json
{
  "family": "drivebook-hybrid",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "drivebook-hybrid",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/drivebook-hybrid:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "hostPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "DRIVEBOOK_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:drivebook-hybrid/api-key"
        },
        {
          "name": "TWILIO_ACCOUNT_SID",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:drivebook-hybrid/twilio-sid"
        },
        {
          "name": "TWILIO_AUTH_TOKEN",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:drivebook-hybrid/twilio-token"
        },
        {
          "name": "TWILIO_PHONE_NUMBER",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:drivebook-hybrid/twilio-phone"
        },
        {
          "name": "STRIPE_SECRET_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:drivebook-hybrid/stripe-key"
        },
        {
          "name": "DRIVEBOOK_BASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:drivebook-hybrid/api-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/drivebook-hybrid",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget -qO- http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 15
      }
    }
  ]
}
```

#### 3. Create ECS Service

In AWS Console → ECS → Services → Create service:

- **Cluster:** Create or select existing
- **Task definition:** drivebook-hybrid:latest
- **Service name:** drivebook-hybrid
- **Desired count:** 2 (for high availability)
- **Load balancer:** Application Load Balancer (ALB)
  - **Target group:** Create new → drivebook-hybrid
  - **Container port:** 3000
  - **Health check path:** /api/health

#### 4. Configure Auto-Scaling

```bash
# Register scalable target (min 2, max 10 replicas)
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/drivebook-cluster/drivebook-hybrid \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# Scale up on CPU >70%
aws application-autoscaling put-scaling-policy \
  --policy-name scale-up \
  --service-namespace ecs \
  --resource-id service/drivebook-cluster/drivebook-hybrid \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration "TargetValue=70.0,PredefinedMetricSpecification={PredefinedMetricType=ECSServiceAverageCPUUtilization},ScaleOutCooldown=60,ScaleInCooldown=300"
```

---

### Option 2: Heroku (Simpler, Quick Deploy)

#### 1. Create Heroku App

```bash
heroku login
heroku create drivebook-hybrid
```

#### 2. Set Environment Variables

```bash
heroku config:set DRIVEBOOK_BASE_URL=https://api.drivebook.com.au
heroku config:set DRIVEBOOK_API_KEY=sk_live_xxxxx
heroku config:set TWILIO_ACCOUNT_SID=ACxxx
heroku config:set TWILIO_AUTH_TOKEN=xxx
heroku config:set TWILIO_PHONE_NUMBER=+61400000000
heroku config:set STRIPE_SECRET_KEY=sk_live_xxx
heroku config:set COPILOT_BASE_URL=https://copilotstudio.microsoft.com/xxxxx
heroku config:set NODE_ENV=production
```

#### 3. Deploy from Git

```bash
git push heroku main
```

Or build and push Docker:

```bash
heroku container:login
docker build -t registry.heroku.com/drivebook-hybrid/web .
docker push registry.heroku.com/drivebook-hybrid/web
heroku container:release web
```

#### 4. Check Status

```bash
heroku logs --tail
heroku open                    # Opens https://drivebook-hybrid.herokuapp.com/api/health
```

---

### Option 3: Railway or Render (Modern Alternatives)

Both offer simple Git-based deploys similar to Heroku:

**Railway:** https://railway.app
- Connect GitHub repo
- Auto-deploy on push
- Env vars in dashboard
- Built-in monitoring

**Render:** https://render.com
- No credit card required
- Free tier available for testing
- Auto-deploy pipelines
- Environment file upload

---

## Post-Deployment

### 1. Verify Deployment

```bash
# Test health endpoint (replace with your URL)
curl https://your-app-url.com/api/health

# Expected response
{
  "status": "ok",
  "uptime": 1234.567
}
```

### 2. Configure Twilio Webhook

In Twilio Console → Phone Numbers → your number:

- **Voice > Webhook on incoming call:** `https://your-app-url.com/api/voice/incoming`
- **Fallback URL:** `https://your-app-url.com/api/health` (heartbeat fallback)

### 3. Set Up Monitoring

#### CloudWatch (AWS)

```bash
# Create log group
aws logs create-log-group --log-group-name /ecs/drivebook-hybrid

# Create alarm for error rate
aws cloudwatch put-metric-alarm \
  --alarm-name drivebook-hybrid-error-rate \
  --alarm-description "Alert on >5% error rate" \
  --metric-name ErrorCount \
  --namespace AWS/ECS \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

#### Sentry (Error Tracking)

Add to `utils/logger.js`:

```javascript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1
});
```

```bash
npm install @sentry/node
```

#### DataDog or New Relic (Fleet Monitoring)

- Send StatsD metrics from `services/` files
- Track API latencies, cache hit rates, error rates

### 4. Database Backups (SQLite)

If using SQLite in production (not recommended long-term), back up daily:

```bash
# In deployment, create daily snapshot
0 2 * * * sqlite3 /app/dev.db ".backup /backups/db-$(date +\%Y\%m\%d).db"
```

For scale, migrate to:
- **PostgreSQL** (managed RDS)
- **MongoDB Atlas** (managed Cloud DB)
- **DynamoDB** (AWS serverless)

---

## Rollback Strategy

### If Deployment Fails

```bash
# AWS ECS: Revert to previous task definition
aws ecs update-service \
  --cluster drivebook-cluster \
  --service drivebook-hybrid \
  --task-definition drivebook-hybrid:5  # Previous version

# Heroku: Rollback to last release
heroku releases
heroku rollback v123
```

---

## Performance Tuning

### Node.js Cluster Mode (For Multi-Core)

Install PM2:

```bash
npm install pm2 --save
```

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "drivebook-hybrid",
      script: "./server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
```

```bash
pm2 start ecosystem.config.js
```

### Database Connection Pooling

Update `services/database-service.js`:

```javascript
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: ["info", "warn"],
  errorFormat: "pretty"
});

// Enable connection pooling
prisma.$on("error", (e) => console.error(e));

module.exports = { prisma };
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Health check failing | Port mismatch | Verify `PORT` env var matches load balancer port |
| Twilio webhook 403 | Missing env vars | Check `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` in secrets manager |
| Slow API calls | DriveBook API latency | Add caching; check `DRIVEBOOK_BASE_URL` reachability |
| Disk full | SQLite DB too large | Migrate to managed DB; archive old messages |
| Memory leak | Unclosed connections | Check Prisma pooling; review long-running timers |

---

## CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS ECS

on:
  push:
    branches: [main, deploy]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run tests
        run: npm ci && npm test

      - name: Build Docker image
        run: docker build -t drivebook-hybrid:${{ github.sha }} .

      - name: Push to ECR
        env:
          AWS_REGION: us-east-1
          ECR_REGISTRY: 123456789.dkr.ecr.us-east-1.amazonaws.com
        run: |
          aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
          docker tag drivebook-hybrid:${{ github.sha }} $ECR_REGISTRY/drivebook-hybrid:latest
          docker push $ECR_REGISTRY/drivebook-hybrid:latest

      - name: Deploy to ECS
        env:
          CLUSTER_NAME: drivebook-cluster
          SERVICE_NAME: drivebook-hybrid
        run: |
          aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --force-new-deployment
```

---

## Summary: 3-Step Online Deployment

1. **Choose platform:** AWS ECS (scale) vs. Heroku (quick) vs. Railway (modern)
2. **Set env vars:** Use secrets manager, not plain `.env`
3. **Test endpoints:** Verify `/api/health` and Twilio webhook POST work
4. **Monitor:** Set up CloudWatch alarms, Sentry, or DataDog

You're deployment-ready! 🚀
