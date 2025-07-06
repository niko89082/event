// routes/forms.js - CRUD operations for forms and submissions
const express = require('express');
const Form = require('../models/Form');
const FormSubmission = require('../models/FormSubmission');
const Event = require('../models/Event');
const protect = require('../middleware/auth');

const router = express.Router();

// ============================================
// FORM CRUD OPERATIONS
// ============================================

/**
 * GET /api/forms/my-forms
 * Get all forms created by the current user
 */
router.get('/my-forms', protect, async (req, res) => {
  try {
    const { 
      category, 
      isActive = true, 
      limit = 20, 
      skip = 0,
      search,
      sortBy = 'lastUsed' 
    } = req.query;

    let query = { createdBy: req.user._id };
    
    if (isActive !== 'all') {
      query.isActive = isActive === 'true';
    }
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    const forms = await Form.find(query)
      .sort({ 
        [sortBy]: sortBy === 'lastUsed' ? -1 : -1,
        createdAt: -1 
      })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    // Get total count for pagination
    const total = await Form.countDocuments(query);

    res.json({
      success: true,
      forms,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > parseInt(skip) + parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get my forms error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch forms' 
    });
  }
});

/**
 * GET /api/forms/popular
 * Get user's most used forms
 */
router.get('/popular', protect, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const forms = await Form.findPopular(req.user._id, parseInt(limit));

    res.json({
      success: true,
      forms
    });

  } catch (error) {
    console.error('Get popular forms error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch popular forms' 
    });
  }
});

/**
 * GET /api/forms/:formId
 * Get a specific form by ID
 */
router.get('/:formId', protect, async (req, res) => {
  try {
    const { formId } = req.params;

    const form = await Form.findById(formId);
    
    if (!form) {
      return res.status(404).json({ 
        success: false, 
        message: 'Form not found' 
      });
    }

    // Check if user has access to this form
    if (String(form.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    res.json({
      success: true,
      form
    });

  } catch (error) {
    console.error('Get form error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch form' 
    });
  }
});

/**
 * POST /api/forms/create
 * Create a new form
 */
router.post('/create', protect, async (req, res) => {
  try {
    const {
      title,
      description,
      questions,
      category = 'other',
      tags = [],
      isTemplate = true,
      settings = {}
    } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Form title is required' 
      });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one question is required' 
      });
    }

    // Validate questions
    const validationErrors = [];
    
    questions.forEach((question, index) => {
      if (!question.question || !question.question.trim()) {
        validationErrors.push(`Question ${index + 1}: Question text is required`);
      }
      
      if (!question.type || !['short_answer', 'multiple_choice', 'yes_no', 'rating', 'checkbox'].includes(question.type)) {
        validationErrors.push(`Question ${index + 1}: Invalid question type`);
      }
      
      if (['multiple_choice', 'checkbox'].includes(question.type)) {
        if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
          validationErrors.push(`Question ${index + 1}: Multiple choice/checkbox questions need at least 2 options`);
        }
      }
      
      if (!question.id) {
        question.id = `q_${Date.now()}_${index}`;
      }
      
      question.order = index;
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation errors',
        errors: validationErrors 
      });
    }

    // Create form
    const form = new Form({
      title: title.trim(),
      description: description ? description.trim() : '',
      createdBy: req.user._id,
      questions,
      category,
      tags: Array.isArray(tags) ? tags : [],
      isTemplate,
      settings: {
        allowMultipleSubmissions: false,
        showProgressBar: true,
        showQuestionNumbers: true,
        submitButtonText: 'Submit',
        ...settings
      }
    });

    await form.save();

    console.log(`✅ Form created: ${form._id} by user ${req.user._id}`);

    res.status(201).json({
      success: true,
      message: 'Form created successfully',
      form
    });

  } catch (error) {
    console.error('Create form error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create form' 
    });
  }
});

/**
 * PUT /api/forms/:formId
 * Update an existing form
 */
router.put('/:formId', protect, async (req, res) => {
  try {
    const { formId } = req.params;
    const {
      title,
      description,
      questions,
      category,
      tags,
      isTemplate,
      settings
    } = req.body;

    const form = await Form.findById(formId);
    
    if (!form) {
      return res.status(404).json({ 
        success: false, 
        message: 'Form not found' 
      });
    }

    // Check ownership
    if (String(form.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Update fields
    if (title) form.title = title.trim();
    if (description !== undefined) form.description = description.trim();
    if (category) form.category = category;
    if (Array.isArray(tags)) form.tags = tags;
    if (isTemplate !== undefined) form.isTemplate = isTemplate;
    if (settings) form.settings = { ...form.settings, ...settings };
    
    if (questions && Array.isArray(questions)) {
      // Validate questions before updating
      const validationErrors = [];
      
      questions.forEach((question, index) => {
        if (!question.question || !question.question.trim()) {
          validationErrors.push(`Question ${index + 1}: Question text is required`);
        }
        
        if (!question.id) {
          question.id = `q_${Date.now()}_${index}`;
        }
        
        question.order = index;
      });

      if (validationErrors.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Validation errors',
          errors: validationErrors 
        });
      }
      
      form.questions = questions;
    }

    await form.save();

    console.log(`✅ Form updated: ${form._id}`);

    res.json({
      success: true,
      message: 'Form updated successfully',
      form
    });

  } catch (error) {
    console.error('Update form error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update form' 
    });
  }
});

/**
 * DELETE /api/forms/:formId
 * Delete a form (soft delete by setting isActive to false)
 */
router.delete('/:formId', protect, async (req, res) => {
  try {
    const { formId } = req.params;

    const form = await Form.findById(formId);
    
    if (!form) {
      return res.status(404).json({ 
        success: false, 
        message: 'Form not found' 
      });
    }

    // Check ownership
    if (String(form.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Check if form is being used by any events
    const eventsUsingForm = await Event.countDocuments({ checkInForm: formId });
    
    if (eventsUsingForm > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete form. It is currently being used by ${eventsUsingForm} event(s)`,
        eventsCount: eventsUsingForm
      });
    }

    // Soft delete
    form.isActive = false;
    await form.save();

    console.log(`✅ Form deleted: ${form._id}`);

    res.json({
      success: true,
      message: 'Form deleted successfully'
    });

  } catch (error) {
    console.error('Delete form error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete form' 
    });
  }
});

// ============================================
// FORM SUBMISSION OPERATIONS
// ============================================

/**
 * POST /api/forms/:formId/submit
 * Submit a form response
 */
router.post('/:formId/submit', protect, async (req, res) => {
  try {
    const { formId } = req.params;
    const { eventId, responses, completionTime } = req.body;

    // Get form and validate
    const form = await Form.findById(formId);
    if (!form || !form.isActive) {
      return res.status(404).json({ 
        success: false, 
        message: 'Form not found or inactive' 
      });
    }

    // Get event and validate
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }

    // Check if form belongs to this event
    if (String(event.checkInForm) !== String(formId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Form does not belong to this event' 
      });
    }

    // Check if user already submitted
    const existingSubmission = await FormSubmission.findOne({
      form: formId,
      user: req.user._id,
      event: eventId
    });

    if (existingSubmission && !form.settings.allowMultipleSubmissions) {
      return res.status(400).json({ 
        success: false, 
        message: 'You have already submitted this form',
        existingSubmission: {
          submittedAt: existingSubmission.submittedAt,
          responses: existingSubmission.responses
        }
      });
    }

    // Validate responses
    const validation = form.validateResponse(responses);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid form responses',
        errors: validation.errors 
      });
    }

    // Prepare responses with question context
    const enrichedResponses = responses.map(response => {
      const question = form.getQuestionById(response.questionId);
      return {
        questionId: response.questionId,
        questionType: question.type,
        questionText: question.question,
        answer: response.answer
      };
    });

    // Create or update submission
    let submission;
    if (existingSubmission && form.settings.allowMultipleSubmissions) {
      existingSubmission.responses = enrichedResponses;
      existingSubmission.submittedAt = new Date();
      existingSubmission.completionTime = completionTime;
      existingSubmission.ipAddress = req.ip;
      existingSubmission.userAgent = req.get('User-Agent');
      submission = await existingSubmission.save();
    } else {
      submission = new FormSubmission({
        form: formId,
        event: eventId,
        user: req.user._id,
        responses: enrichedResponses,
        completionTime,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
      await submission.save();
      
      // Add to event's form submissions
      if (!event.formSubmissions.includes(submission._id)) {
        event.formSubmissions.push(submission._id);
        await event.save();
      }
    }

    // Increment form usage count
    if (!existingSubmission) {
      await form.incrementUsage();
    }

    console.log(`✅ Form submitted: ${formId} by user ${req.user._id} for event ${eventId}`);

    res.status(201).json({
      success: true,
      message: 'Form submitted successfully',
      submission: {
        _id: submission._id,
        submittedAt: submission.submittedAt,
        isComplete: submission.isComplete
      }
    });

  } catch (error) {
    console.error('Submit form error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit form' 
    });
  }
});

/**
 * GET /api/forms/:formId/submissions
 * Get all submissions for a form
 */
router.get('/:formId/submissions', protect, async (req, res) => {
  try {
    const { formId } = req.params;
    const { 
      eventId, 
      limit = 50, 
      skip = 0, 
      status,
      sortBy = 'submittedAt',
      sortOrder = 'desc'
    } = req.query;

    // Get form and check ownership
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ 
        success: false, 
        message: 'Form not found' 
      });
    }

    if (String(form.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const options = {
      limit: parseInt(limit),
      skip: parseInt(skip),
      sortBy,
      sortOrder: sortOrder === 'desc' ? -1 : 1,
      populateUser: true,
      populateEvent: !eventId
    };

    if (status) options.status = status;
    if (eventId) options.eventId = eventId;

    const submissions = await FormSubmission.findByForm(formId, options);
    
    // Get total count
    const totalQuery = { form: formId };
    if (eventId) totalQuery.event = eventId;
    if (status) totalQuery.status = status;
    
    const total = await FormSubmission.countDocuments(totalQuery);

    res.json({
      success: true,
      submissions,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > parseInt(skip) + parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get form submissions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch submissions' 
    });
  }
});

/**
 * GET /api/forms/:formId/stats
 * Get form submission statistics
 */
router.get('/:formId/stats', protect, async (req, res) => {
  try {
    const { formId } = req.params;
    const { eventId } = req.query;

    // Get form and check ownership
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ 
        success: false, 
        message: 'Form not found' 
      });
    }

    if (String(form.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const stats = await FormSubmission.getSubmissionStats(formId, eventId);

    res.json({
      success: true,
      stats: stats[0] || {
        totalSubmissions: 0,
        averageCompletionTime: 0,
        statusCounts: { submitted: 0, reviewed: 0, flagged: 0 }
      }
    });

  } catch (error) {
    console.error('Get form stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch form statistics' 
    });
  }
});

module.exports = router;