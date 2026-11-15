CREATE TABLE "advisor_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Cuộc trò chuyện mới',
    "needs" JSONB NOT NULL DEFAULT '{}',
    "lastQuestion" TEXT,
    "isProcessing" BOOLEAN NOT NULL DEFAULT false,
    "processingStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "advisor_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "candidates" JSONB,
    "pricingNotice" TEXT,
    "action" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advisor_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "advisor_conversations_userId_updatedAt_idx"
    ON "advisor_conversations"("userId", "updatedAt");
CREATE INDEX "advisor_messages_conversationId_createdAt_idx"
    ON "advisor_messages"("conversationId", "createdAt");

ALTER TABLE "advisor_conversations"
    ADD CONSTRAINT "advisor_conversations_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "advisor_messages"
    ADD CONSTRAINT "advisor_messages_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "advisor_conversations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
