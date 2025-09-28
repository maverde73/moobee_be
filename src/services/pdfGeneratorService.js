/**
 * PDF Generator Service
 * Servizio per generazione report PDF con Puppeteer
 * @module services/pdfGeneratorService
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const logger = require('../utils/logger');

class PDFGeneratorService {
  constructor() {
    this.templatesPath = path.join(__dirname, '..', 'templates', 'reports');
    this.outputPath = path.join(__dirname, '..', '..', 'public', 'reports');
    this.browser = null;
    this.initializeHelpers();
  }

  /**
   * Initialize Handlebars helpers
   */
  initializeHelpers() {
    // Format date helper
    handlebars.registerHelper('formatDate', (date) => {
      return new Date(date).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    });

    // Format percentage helper
    handlebars.registerHelper('percentage', (value) => {
      return Math.round(value) + '%';
    });

    // Conditional helper for score colors
    handlebars.registerHelper('scoreColor', (score) => {
      if (score >= 80) return '#10B981'; // green
      if (score >= 60) return '#F59E0B'; // yellow
      return '#EF4444'; // red
    });

    // Trend icon helper
    handlebars.registerHelper('trendIcon', (trend) => {
      switch(trend) {
        case 'IMPROVING': return '↑';
        case 'DECLINING': return '↓';
        default: return '→';
      }
    });

    // Comparison helper
    handlebars.registerHelper('comparison', (value1, operator, value2) => {
      switch(operator) {
        case '>': return value1 > value2;
        case '<': return value1 < value2;
        case '>=': return value1 >= value2;
        case '<=': return value1 <= value2;
        case '==': return value1 == value2;
        default: return false;
      }
    });
  }

  /**
   * Initialize browser instance
   */
  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });
    }
    return this.browser;
  }

  /**
   * Generate assessment report PDF
   */
  async generateAssessmentReport(data) {
    try {
      // Ensure output directory exists
      await fs.mkdir(this.outputPath, { recursive: true });

      // Load and compile template
      const templatePath = path.join(this.templatesPath, 'assessment-report.html');
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const template = handlebars.compile(templateContent);

      // Generate HTML with data
      const html = template({
        ...data,
        generatedAt: new Date().toISOString(),
        logoUrl: '/assets/logo.png',
        chartData: this.prepareChartData(data.softSkills)
      });

      // Initialize browser
      await this.initBrowser();
      const page = await this.browser.newPage();

      // Set viewport for consistent rendering
      await page.setViewport({ width: 1200, height: 1600 });

      // Set HTML content
      await page.setContent(html, {
        waitUntil: 'networkidle0'
      });

      // Generate radar chart using client-side rendering
      if (data.softSkills && data.softSkills.length > 0) {
        await page.evaluate((skills) => {
          // Inject chart rendering script
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
          document.head.appendChild(script);
        }, data.softSkills);

        // Wait for chart library to load
        await page.waitForTimeout(1000);
      }

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      await page.close();

      // Save PDF to file
      const fileName = `assessment_${data.userId}_${Date.now()}.pdf`;
      const filePath = path.join(this.outputPath, fileName);
      await fs.writeFile(filePath, pdfBuffer);

      logger.info('PDF generated successfully', {
        fileName,
        size: pdfBuffer.length
      }, 'PDFGeneratorService');

      return {
        success: true,
        fileName,
        path: `/reports/${fileName}`,
        size: pdfBuffer.length
      };

    } catch (error) {
      logger.error('Error generating PDF', error, 'PDFGeneratorService');
      throw error;
    }
  }

  /**
   * Generate skills comparison report
   */
  async generateComparisonReport(data) {
    try {
      const templatePath = path.join(this.templatesPath, 'comparison-report.html');
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const template = handlebars.compile(templateContent);

      const html = template({
        ...data,
        generatedAt: new Date().toISOString()
      });

      await this.initBrowser();
      const page = await this.browser.newPage();

      await page.setViewport({ width: 1200, height: 1600 });
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: {
          top: '15mm',
          right: '10mm',
          bottom: '15mm',
          left: '10mm'
        }
      });

      await page.close();

      const fileName = `comparison_${Date.now()}.pdf`;
      const filePath = path.join(this.outputPath, fileName);
      await fs.writeFile(filePath, pdfBuffer);

      return {
        success: true,
        fileName,
        path: `/reports/${fileName}`,
        size: pdfBuffer.length
      };

    } catch (error) {
      logger.error('Error generating comparison report', error, 'PDFGeneratorService');
      throw error;
    }
  }

  /**
   * Generate team analytics report
   */
  async generateTeamReport(data) {
    try {
      const templatePath = path.join(this.templatesPath, 'team-report.html');
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const template = handlebars.compile(templateContent);

      const html = template({
        ...data,
        statistics: this.calculateTeamStatistics(data.members),
        generatedAt: new Date().toISOString()
      });

      await this.initBrowser();
      const page = await this.browser.newPage();

      await page.setViewport({ width: 1200, height: 1600 });
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      await page.close();

      const fileName = `team_${data.teamId}_${Date.now()}.pdf`;
      const filePath = path.join(this.outputPath, fileName);
      await fs.writeFile(filePath, pdfBuffer);

      return {
        success: true,
        fileName,
        path: `/reports/${fileName}`,
        size: pdfBuffer.length
      };

    } catch (error) {
      logger.error('Error generating team report', error, 'PDFGeneratorService');
      throw error;
    }
  }

  /**
   * Prepare chart data for visualization
   */
  prepareChartData(softSkills) {
    if (!softSkills || softSkills.length === 0) {
      return null;
    }

    return {
      labels: softSkills.map(s => s.skill),
      datasets: [{
        label: 'Punteggio',
        data: softSkills.map(s => s.score),
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2
      }]
    };
  }

  /**
   * Calculate team statistics
   */
  calculateTeamStatistics(members) {
    if (!members || members.length === 0) {
      return {
        avgScore: 0,
        topPerformers: 0,
        needsImprovement: 0,
        totalAssessments: 0
      };
    }

    const scores = members.map(m => m.avgScore || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
      avgScore: Math.round(avgScore),
      topPerformers: scores.filter(s => s >= 80).length,
      needsImprovement: scores.filter(s => s < 60).length,
      totalAssessments: members.length
    };
  }

  /**
   * Clean up browser instance
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Generate certificate PDF
   */
  async generateCertificate(data) {
    try {
      const templatePath = path.join(this.templatesPath, 'certificate.html');
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const template = handlebars.compile(templateContent);

      const html = template({
        ...data,
        date: new Date().toLocaleDateString('it-IT'),
        certNumber: `CERT-${Date.now()}`
      });

      await this.initBrowser();
      const page = await this.browser.newPage();

      await page.setViewport({ width: 1200, height: 850 });
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });

      await page.close();

      const fileName = `certificate_${data.userId}_${Date.now()}.pdf`;
      const filePath = path.join(this.outputPath, fileName);
      await fs.writeFile(filePath, pdfBuffer);

      return {
        success: true,
        fileName,
        path: `/reports/${fileName}`,
        size: pdfBuffer.length
      };

    } catch (error) {
      logger.error('Error generating certificate', error, 'PDFGeneratorService');
      throw error;
    }
  }
}

// Export singleton instance
const pdfGenerator = new PDFGeneratorService();
module.exports = pdfGenerator;